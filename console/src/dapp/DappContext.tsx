import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledAlphynContract } from '../alphyn-contract';
import { connectWallet, buildProviders, NETWORK_ID } from '../providers';
import { createAlphynPrivateState } from '../witnesses';
import {
  PRIVATE_STATE_ID,
  categoryEnum,
  joinVaultContract,
  createVault as cvCreateVault,
  rebalance as cvRebalance,
  follow as cvFollow,
  deposit as cvDeposit,
  readLeaderboard,
  type LeaderboardRow,
} from '../alphyn-api';
import { rand32, type Strategy } from '../strategy';
import { deriveVaultKey, seal, unseal, type Sealed } from './vaultCrypto';
import { fetchOracle } from './priceFeed';

export type Category = 'conservative' | 'balanced' | 'aggressive';

// Local execution bridge (deploy/src/bridge.ts). When it is running, all
// on-chain ops go through the operator wallet there instead of the browser
// extension — the extension moved to the v9 tx line the public compiler cannot
// target yet, while the bridge's headless v8 wallet still submits fine.
const BRIDGE = 'http://localhost:6363';
const bridgeFetch = async (path: string, body?: unknown) => {
  const res = await fetch(`${BRIDGE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `bridge ${path} failed (${res.status})`);
  return data;
};
const probeBridge = async (): Promise<{ contract: string } | null> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${BRIDGE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
};
const catOrdinal = (c: Category) => (c === 'conservative' ? 0 : c === 'balanced' ? 1 : 2);

export interface LocalVault {
  vaultId: string;
  contractAddress: string;
  name: string;
  category: Category;
  allocation: number[];
  rebalanceTriggerPct: number;
  stopLossPct: number;
  epochDurationSeconds: number;
  maxSlippageBps: number;
  source: 'ai' | 'local';
  principal: number;
  createdAt: number;
  epochs: { n: number; pnlBps: number; ts: number }[];
  secretHex: string;
  nonceHex: string;
  following: string | null;
  active: boolean;
  locked?: boolean; // secrets not available at rest (no wallet signing) → read-only
  managed?: boolean; // secrets live in the local bridge, not in this browser
}

// What is written to disk. The private fields live only inside `sealed`.
interface VaultRecord {
  vaultId: string;
  contractAddress: string;
  name: string;
  category: Category;
  rebalanceTriggerPct: number;
  stopLossPct: number;
  epochDurationSeconds: number;
  maxSlippageBps: number;
  source: 'ai' | 'local';
  principal: number;
  createdAt: number;
  epochs: { n: number; pnlBps: number; ts: number }[];
  following: string | null;
  active: boolean;
  sealed: Sealed | null;
  managed?: boolean;
  allocationPlain?: number[]; // bridge-managed vaults: kept for display; secret stays in the bridge
}
interface SecretPart {
  secretHex: string;
  nonceHex: string;
  allocation: number[];
}

type Phase = 'connecting' | 'need-wallet' | 'ready';

export interface Toast {
  id: string;
  kind: 'success' | 'error';
  title: string;
  body?: string;
  txId?: string | null;
}

interface DappValue {
  phase: Phase;
  error: string | null;
  wrongNetwork: boolean;
  sealAvailable: boolean;
  bridgeMode: boolean;
  toasts: Toast[];
  notify: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  address: string;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  vaults: LocalVault[];
  vaultById: (id: string) => LocalVault | undefined;
  contractAddress: string | null;
  leaderboard: LeaderboardRow[];
  refreshLeaderboard: () => Promise<void>;
  mint: (s: Strategy, name: string) => Promise<LocalVault>;
  runEpoch: (vaultId: string) => Promise<void>;
  setPrincipal: (vaultId: string, amount: number) => void;
  depositReal: (vaultId: string, amount: bigint) => Promise<void>;
  renameVault: (vaultId: string, name: string) => void;
  follow: (vaultId: string, targetId: string, pct: number) => Promise<void>;
  unfollow: (vaultId: string) => Promise<void>;
  closeVault: (vaultId: string) => Promise<void>;
}

const Ctx = createContext<DappValue | null>(null);
export const useDapp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDapp outside provider');
  return v;
};

// Map raw node/SDK failures to something a person can act on. The big one is the
// v8/v9 line gap: Preview now speaks the v9 transaction format, but the public
// Compact compiler still emits v8 artifacts, so live submits bounce until the v9
// toolchain ships.
const explainTxError = (e: any): Error => {
  const m = String(e?.message ?? e);
  if (/could not balance dust|InsufficientFunds/i.test(m)) {
    return new Error(
      'The operator wallet is low on dust (the fee resource, which regenerates from NIGHT over time). It refills on its own — wait a minute and retry.',
    );
  }
  const dustCode = m.match(/Custom error:\s*(\d+)/i)?.[1];
  if (dustCode === '170') {
    return new Error(`Dust proof rejected (Custom error 170) — proof server version mismatch (needs 8.1.0). Raw: ${m}`);
  }
  if (dustCode === '171') {
    return new Error(`Dust out of validity window (Custom error 171) — indexer timestamp stale/lagging. Retry shortly. Raw: ${m}`);
  }
  if (/proof-versioned|1010: Invalid Transaction/i.test(m)) {
    return new Error(`Transaction format rejected by node (possible ledger version gap). Raw: ${m}`);
  }
  return e instanceof Error ? e : new Error(m);
};

const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
const sha256hex = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return toHex(new Uint8Array(buf));
};
const randSaltHex = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toHex(a);
};
const bigAlloc = (a: number[]): [bigint, bigint, bigint, bigint] =>
  [BigInt(a[0] ?? 0), BigInt(a[1] ?? 0), BigInt(a[2] ?? 0), BigInt(a[3] ?? 0)];

async function readAddress(api: any): Promise<string> {
  try {
    if (typeof api.getUnshieldedAddress === 'function') return (await api.getUnshieldedAddress()).unshieldedAddress;
    if (typeof api.getShieldedAddresses === 'function') return (await api.getShieldedAddresses()).shieldedCoinPublicKey;
  } catch {
    /* ignore */
  }
  return 'default';
}

async function readNetwork(api: any): Promise<string | null> {
  try {
    if (typeof api.getConnectionStatus === 'function') {
      const s = await api.getConnectionStatus();
      if (s && typeof s === 'object' && 'networkId' in s) return (s as any).networkId;
    }
    if (typeof api.getConfiguration === 'function') return (await api.getConfiguration()).networkId ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

export function DappProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('need-wallet');
  const [error, setError] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [bridgeMode, setBridgeMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [providers, setProviders] = useState<any>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    // Success toasts self-dismiss; errors stay until the user closes them.
    if (t.kind === 'success') setTimeout(() => dismissToast(id), 8000);
  }, [dismissToast]);
  const [vaults, setVaults] = useState<LocalVault[]>([]);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [address, setAddress] = useState<string>('');

  const apiRef = useRef<any>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const addrRef = useRef<string>('default');
  // Guards against concurrent mints: a second call while one is in flight produces
  // duplicate wallet submits that the node temporarily bans (masking real errors).
  const mintingRef = useRef(false);

  const lsVaults = () => `alphyn.vaults.${addrRef.current}`;
  const lsAddr = () => `alphyn.contract.${addrRef.current}`;

  const persist = useCallback(async (next: LocalVault[]) => {
    setVaults(next);
    const key = keyRef.current;
    const records: VaultRecord[] = [];
    for (const v of next) {
      let sealed: Sealed | null = null;
      if (!v.managed && key && !v.locked) {
        const part: SecretPart = { secretHex: v.secretHex, nonceHex: v.nonceHex, allocation: v.allocation };
        sealed = await seal(key, part);
      }
      const { secretHex, nonceHex, allocation, locked, ...pub } = v;
      records.push({ ...pub, sealed, allocationPlain: v.managed ? allocation : undefined });
    }
    localStorage.setItem(lsVaults(), JSON.stringify(records));
  }, []);

  const loadVaults = useCallback(async () => {
    const raw = localStorage.getItem(lsVaults());
    if (!raw) return;
    let records: VaultRecord[] = [];
    try {
      records = JSON.parse(raw);
    } catch {
      return;
    }
    const key = keyRef.current;
    const out: LocalVault[] = [];
    for (const r of records) {
      if (r.managed) {
        // Secrets live in the local bridge; the browser only needs the public
        // shape plus the allocation for display and notional math.
        out.push({ ...r, secretHex: '', nonceHex: '', allocation: r.allocationPlain ?? [0, 0, 0, 0], locked: false });
        continue;
      }
      let secret: SecretPart | null = null;
      if (key && r.sealed) secret = await unseal<SecretPart>(key, r.sealed);
      out.push({
        ...r,
        secretHex: secret?.secretHex ?? '',
        nonceHex: secret?.nonceHex ?? '',
        allocation: secret?.allocation ?? [0, 0, 0, 0],
        locked: !secret,
      });
    }
    setVaults(out);
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    setError(null);
    setPhase('connecting');
    try {
      // Always connect the user's wallet first — it is the identity, and it signs
      // each mint to derive that vault's secret (so the vault is theirs).
      const api = await connectWallet();
      apiRef.current = api;
      addrRef.current = await readAddress(api);
      setAddress(addrRef.current);
      const net = await readNetwork(api);
      setWrongNetwork(net != null && net !== NETWORK_ID);

      // If the local bridge is up it relays the transactions the v9 wallet cannot
      // submit; otherwise fall back to submitting directly through the wallet.
      const bridge = await probeBridge();
      if (bridge) {
        setBridgeMode(true);
        setContractAddress(bridge.contract);
        // vaults load via the poll effect
      } else {
        keyRef.current = await deriveVaultKey(api);
        const p = await buildProviders(api);
        setProviders(p);
        setContractAddress(localStorage.getItem(lsAddr()));
        await loadVaults();
      }
      setPhase('ready');
      return true;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('need-wallet');
      return false;
    }
  }, [loadVaults]);

  // Drop the current wallet session so the user can connect a different one. This
  // clears the derived key, providers and in-memory vaults; on-chain state and any
  // sealed localStorage records survive and reload when a wallet reconnects. It
  // does not auto-reconnect (the mount effect runs once), so the connect screen
  // shows until the user picks a wallet again.
  const disconnect = useCallback(() => {
    try { apiRef.current?.disconnect?.(); } catch { /* connector may not support it */ }
    apiRef.current = null;
    keyRef.current = null;
    addrRef.current = 'default';
    setAddress('');
    setProviders(null);
    setBridgeMode(false);
    setContractAddress(null);
    setVaults([]);
    setLeaderboard([]);
    setWrongNetwork(false);
    setError(null);
    setPhase('need-wallet');
  }, []);

  // No auto-connect on mount: the landing page owns the connect action (its
  // "Launch App" button calls connect()), so opening the site never pops the
  // wallet unprompted.

  const privateStateFor = (v: LocalVault) =>
    createAlphynPrivateState(fromHex(v.secretHex), bigAlloc(v.allocation), fromHex(v.nonceHex));
  const joinFor = (v: LocalVault) => joinVaultContract(providers, v.contractAddress, privateStateFor(v));
  const requireUnlocked = (v: LocalVault | undefined) => {
    if (!v) throw new Error('vault not found');
    if (v.managed) return v; // the bridge holds its secrets
    if (v.locked || !v.secretHex) throw new Error('This vault is locked. Reconnect a wallet that can sign to unlock it.');
    return v;
  };

  const refreshLeaderboard = useCallback(async () => {
    if (bridgeMode) {
      try {
        const rows = await bridgeFetch('/leaderboard');
        setLeaderboard(
          rows.map((r: any) => ({
            id: r.id,
            category: r.category,
            assetCount: BigInt(r.assetCount),
            epochCount: BigInt(r.epochCount),
            netPnlScaled: BigInt(r.netPnlScaled),
            followers: BigInt(r.followers),
            active: r.active,
          })),
        );
      } catch {
        /* ignore */
      }
      return;
    }
    if (!providers || !contractAddress) return;
    try {
      setLeaderboard(await readLeaderboard(providers, contractAddress));
    } catch {
      /* ignore */
    }
  }, [bridgeMode, providers, contractAddress]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // In bridge mode the bridge is the source of truth for the user's vaults
  // (it runs the keeper). Map its public projection to LocalVault.
  const CATS: Category[] = ['conservative', 'balanced', 'aggressive'];
  const mapBridgeVault = useCallback(
    (b: any): LocalVault => ({
      vaultId: b.vaultId,
      contractAddress: contractAddress ?? 'bridge',
      name: b.name,
      category: CATS[b.category] ?? 'aggressive',
      allocation: b.allocation ?? [0, 0, 0, 0],
      rebalanceTriggerPct: b.rebalanceTriggerPct ?? 4,
      stopLossPct: b.stopLossPct ?? 12,
      epochDurationSeconds: b.epochDurationSeconds ?? 3600,
      maxSlippageBps: b.maxSlippageBps ?? 50,
      source: 'local',
      principal: b.principal ?? 0,
      createdAt: b.createdAt ?? Date.now(),
      epochs: b.epochs ?? [],
      secretHex: '',
      nonceHex: '',
      following: b.following ?? null,
      active: b.active,
      managed: true,
    }),
    [contractAddress],
  );

  const refreshManagedVaults = useCallback(async () => {
    if (!bridgeMode) return;
    try {
      const rows = await bridgeFetch('/vaults');
      const mine = rows.filter((r: any) => !r.owner || r.owner === addrRef.current);
      setVaults(mine.map(mapBridgeVault));
    } catch {
      /* ignore */
    }
  }, [bridgeMode, mapBridgeVault]);

  // Poll the bridge so keeper-run epochs (and their PnL) appear on their own.
  useEffect(() => {
    if (!bridgeMode) return;
    refreshManagedVaults();
    const t = setInterval(() => {
      refreshManagedVaults();
      refreshLeaderboard();
    }, 8000);
    return () => clearInterval(t);
  }, [bridgeMode, refreshManagedVaults, refreshLeaderboard]);

  const mint = useCallback(
    async (s: Strategy, name: string): Promise<LocalVault> => {
      if (mintingRef.current) throw new Error('A mint is already in progress — wait for it to finish.');
      mintingRef.current = true;
      try {
      if (bridgeMode) {
        // The user's wallet signs to authorize the mint and derive this vault's
        // secret, so the vault (vaultId = hash(secret)) belongs to their key. The
        // bridge only relays the transaction.
        const salt = randSaltHex();
        let secretHex = '';
        let nonceHex = '';
        const api = apiRef.current;
        if (api && typeof api.signData === 'function') {
          const sig = await api.signData(`alphyn-vault:${salt}`, { encoding: 'text', keyType: 'unshielded' });
          secretHex = await sha256hex(`${sig.signature}:${salt}`);
          nonceHex = await sha256hex(`${sig.signature}:${salt}:nonce`);
        }
        const out = await bridgeFetch('/mint', {
          allocation: s.allocation,
          category: catOrdinal(s.category),
          assetCount: s.assetCount,
          name,
          epochDurationSeconds: s.epochDurationSeconds,
          rebalanceTriggerPct: s.rebalanceTriggerPct,
          stopLossPct: s.stopLossPct,
          maxSlippageBps: s.maxSlippageBps,
          secretHex,
          nonceHex,
          owner: addrRef.current,
        });
        const v = mapBridgeVault(out.vault);
        await refreshManagedVaults();
        refreshLeaderboard();
        notify({ kind: 'success', title: 'Strategy minted', body: v.name, txId: out.txHash ?? null });
        return v;
      }
      const secret = rand32();
      const nonce = rand32();
      const ps = createAlphynPrivateState(secret, bigAlloc(s.allocation), nonce);

      let address = contractAddress ?? localStorage.getItem(lsAddr());
      let contract: any;
      const deployFresh = async () => {
        const deployed = await deployContract(providers, {
          compiledContract: CompiledAlphynContract,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: ps,
        });
        address = deployed.deployTxData.public.contractAddress as string;
        contract = deployed;
        setContractAddress(address);
        localStorage.setItem(lsAddr(), address);
      };
      if (address) {
        try {
          contract = await joinVaultContract(providers, address, ps);
        } catch {
          // The contract at this address predates the current circuit set (its
          // verifier keys don't include newer circuits like deposit/withdraw).
          // Deploy a fresh contract that matches this build and re-point to it.
          await deployFresh();
        }
      } else {
        await deployFresh();
      }

      const before = new Set((await readLeaderboard(providers, address)).map((r) => r.id));
      const mintTx = await cvCreateVault(contract, categoryEnum(s.category), BigInt(s.assetCount));
      const after = await readLeaderboard(providers, address);
      setLeaderboard(after);
      const vaultId = after.find((r) => !before.has(r.id))?.id ?? `local-${Date.now()}`;

      const v: LocalVault = {
        vaultId,
        contractAddress: address,
        name: name.trim() || `Vault ${vaultId.slice(0, 6)}`,
        category: s.category,
        allocation: s.allocation,
        rebalanceTriggerPct: s.rebalanceTriggerPct,
        stopLossPct: s.stopLossPct,
        epochDurationSeconds: s.epochDurationSeconds,
        maxSlippageBps: s.maxSlippageBps,
        source: s.source,
        principal: 0,
        createdAt: Date.now(),
        epochs: [],
        secretHex: toHex(secret),
        nonceHex: toHex(nonce),
        following: null,
        active: true,
      };
      await persist([...vaults, v]);
      notify({ kind: 'success', title: 'Strategy minted', body: v.name, txId: (mintTx as any)?.public?.txHash ?? null });
      return v;
      } catch (e) {
        throw explainTxError(e);
      } finally {
        mintingRef.current = false;
      }
    },
    [bridgeMode, providers, contractAddress, vaults, persist, refreshLeaderboard, mapBridgeVault, refreshManagedVaults, notify],
  );

  const runEpoch = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          // The bridge picks the oracle, runs the tx, and records the epoch.
          await bridgeFetch('/epoch', { vaultId });
          await refreshManagedVaults();
          refreshLeaderboard();
          return;
        }
        const { up, down } = await fetchOracle();
        const contract = await joinFor(v);
        await cvRebalance(contract, up.map((x) => BigInt(x)), down.map((x) => BigInt(x)));
        const num = v.allocation.reduce((acc, w, i) => acc + w * up[i] - w * down[i], 0);
        const pnlBps = Math.round(num / 100);
        const updated: LocalVault = { ...v, epochs: [...v.epochs, { n: v.epochs.length + 1, pnlBps, ts: Date.now() }] };
        await persist(vaults.map((x) => (x.vaultId === vaultId ? updated : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard, refreshManagedVaults],
  );

  const setPrincipal = useCallback(
    (vaultId: string, amount: number) => {
      const v = vaults.find((x) => x.vaultId === vaultId);
      if (v?.managed) {
        bridgeFetch('/principal', { vaultId, amount }).then(refreshManagedVaults).catch(() => {});
        return;
      }
      persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, principal: amount } : x)));
    },
    [vaults, persist, refreshManagedVaults],
  );
  // Real on-chain deposit (Path A phase 1): move actual tNIGHT into the vault's
  // custody via the `deposit` circuit. `amount` is native-token base units. The
  // wallet balancing supplies the coin the contract's receiveUnshielded pulls in.
  const depositReal = useCallback(
    async (vaultId: string, amount: bigint) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) throw new Error('Managed (bridge) vaults deposit through the bridge, not the wallet.');
        const contract = await joinFor(v);
        await cvDeposit(contract, amount);
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, refreshLeaderboard],
  );

  const renameVault = useCallback(
    (vaultId: string, name: string) => {
      const v = vaults.find((x) => x.vaultId === vaultId);
      if (v?.managed) {
        bridgeFetch('/rename', { vaultId, name }).then(refreshManagedVaults).catch(() => {});
        return;
      }
      persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, name } : x)));
    },
    [vaults, persist, refreshManagedVaults],
  );

  const follow = useCallback(
    async (vaultId: string, targetId: string, pct: number) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/follow', { vaultId, targetId: targetId.replace(/^0x/, ''), pct });
          await refreshManagedVaults();
          refreshLeaderboard();
          return;
        }
        const contract = await joinFor(v);
        await cvFollow(contract, fromHex(targetId.replace(/^0x/, '')), BigInt(pct));
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: targetId } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard, refreshManagedVaults],
  );
  const unfollow = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/unfollow', { vaultId });
          await refreshManagedVaults();
          refreshLeaderboard();
          return;
        }
        const contract = await joinFor(v);
        await contract.callTx.unfollow();
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: null } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard, refreshManagedVaults],
  );
  const closeVault = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/close', { vaultId });
          await refreshManagedVaults();
          refreshLeaderboard();
          return;
        }
        const contract = await joinFor(v);
        await contract.callTx.closeVault();
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, active: false } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard, refreshManagedVaults],
  );

  const value: DappValue = {
    phase,
    error,
    wrongNetwork,
    sealAvailable: !!keyRef.current,
    bridgeMode,
    toasts,
    notify,
    dismissToast,
    address,
    connect,
    disconnect,
    vaults,
    vaultById: (id) => vaults.find((v) => v.vaultId === id),
    contractAddress,
    leaderboard,
    refreshLeaderboard,
    mint,
    runEpoch,
    setPrincipal,
    depositReal,
    renameVault,
    follow,
    unfollow,
    closeVault,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

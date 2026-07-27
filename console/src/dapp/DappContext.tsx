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

interface DappValue {
  phase: Phase;
  error: string | null;
  wrongNetwork: boolean;
  sealAvailable: boolean;
  bridgeMode: boolean;
  connect: () => Promise<void>;
  vaults: LocalVault[];
  vaultById: (id: string) => LocalVault | undefined;
  contractAddress: string | null;
  leaderboard: LeaderboardRow[];
  refreshLeaderboard: () => Promise<void>;
  mint: (s: Strategy, name: string) => Promise<LocalVault>;
  runEpoch: (vaultId: string) => Promise<void>;
  setPrincipal: (vaultId: string, amount: number) => void;
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
  if (/proof-versioned|Custom error: 170|InvalidDustSpendProof|1010: Invalid Transaction/i.test(m)) {
    return new Error(
      'Network version gap: Preview has moved to the v9 transaction format, while this build runs on the stable v8 SDK (the v9 Compact compiler is not published yet). The proof was generated fine; the node rejected the submit format. On-chain submits resume when Midnight ships the v9 toolchain.',
    );
  }
  return e instanceof Error ? e : new Error(m);
};

const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
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
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [bridgeMode, setBridgeMode] = useState(false);
  const [providers, setProviders] = useState<any>(null);
  const [vaults, setVaults] = useState<LocalVault[]>([]);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const apiRef = useRef<any>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const addrRef = useRef<string>('default');

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

  const connect = useCallback(async () => {
    setError(null);
    setPhase('connecting');
    // Prefer the local bridge when it is up: it executes with a wallet the
    // current network still accepts, and needs no extension at all.
    const bridge = await probeBridge();
    if (bridge) {
      setBridgeMode(true);
      addrRef.current = 'bridge';
      setContractAddress(bridge.contract);
      localStorage.setItem(lsAddr(), bridge.contract);
      await loadVaults();
      setPhase('ready');
      return;
    }
    try {
      const api = await connectWallet();
      apiRef.current = api;
      const p = await buildProviders(api);
      setProviders(p);
      addrRef.current = await readAddress(api);
      keyRef.current = await deriveVaultKey(api);
      const net = await readNetwork(api);
      setWrongNetwork(net != null && net !== NETWORK_ID);
      setContractAddress(localStorage.getItem(lsAddr()));
      await loadVaults();
      setPhase('ready');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('need-wallet');
    }
  }, [loadVaults]);

  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const mint = useCallback(
    async (s: Strategy, name: string): Promise<LocalVault> => {
      try {
      if (bridgeMode) {
        const out = await bridgeFetch('/mint', {
          allocation: s.allocation,
          category: catOrdinal(s.category),
          assetCount: s.assetCount,
        });
        const v: LocalVault = {
          vaultId: out.vaultId,
          contractAddress: contractAddress ?? 'bridge',
          name: name.trim() || `Vault ${String(out.vaultId).slice(0, 6)}`,
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
          secretHex: '',
          nonceHex: '',
          following: null,
          active: true,
          managed: true,
        };
        await persist([...vaults, v]);
        refreshLeaderboard();
        return v;
      }
      const secret = rand32();
      const nonce = rand32();
      const ps = createAlphynPrivateState(secret, bigAlloc(s.allocation), nonce);

      let address = contractAddress ?? localStorage.getItem(lsAddr());
      let contract: any;
      if (address) {
        contract = await joinVaultContract(providers, address, ps);
      } else {
        const deployed = await deployContract(providers, {
          compiledContract: CompiledAlphynContract,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: ps,
        });
        address = deployed.deployTxData.public.contractAddress as string;
        contract = deployed;
        setContractAddress(address);
        localStorage.setItem(lsAddr(), address);
      }

      const before = new Set((await readLeaderboard(providers, address)).map((r) => r.id));
      await cvCreateVault(contract, categoryEnum(s.category), BigInt(s.assetCount));
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
      return v;
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [bridgeMode, providers, contractAddress, vaults, persist, refreshLeaderboard],
  );

  const runEpoch = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        const { up, down } = await fetchOracle();
        if (v.managed) {
          await bridgeFetch('/epoch', { vaultId, up, down });
        } else {
          const contract = await joinFor(v);
          await cvRebalance(contract, up.map((x) => BigInt(x)), down.map((x) => BigInt(x)));
        }
        const num = v.allocation.reduce((acc, w, i) => acc + w * up[i] - w * down[i], 0);
        const pnlBps = Math.round(num / 100);
        const updated: LocalVault = { ...v, epochs: [...v.epochs, { n: v.epochs.length + 1, pnlBps, ts: Date.now() }] };
        await persist(vaults.map((x) => (x.vaultId === vaultId ? updated : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard],
  );

  const setPrincipal = useCallback(
    (vaultId: string, amount: number) => {
      persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, principal: amount } : x)));
    },
    [vaults, persist],
  );
  const renameVault = useCallback(
    (vaultId: string, name: string) => {
      persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, name } : x)));
    },
    [vaults, persist],
  );

  const follow = useCallback(
    async (vaultId: string, targetId: string, pct: number) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/follow', { vaultId, targetId: targetId.replace(/^0x/, ''), pct });
        } else {
          const contract = await joinFor(v);
          await cvFollow(contract, fromHex(targetId.replace(/^0x/, '')), BigInt(pct));
        }
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: targetId } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard],
  );
  const unfollow = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/unfollow', { vaultId });
        } else {
          const contract = await joinFor(v);
          await contract.callTx.unfollow();
        }
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: null } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard],
  );
  const closeVault = useCallback(
    async (vaultId: string) => {
      try {
        const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
        if (v.managed) {
          await bridgeFetch('/close', { vaultId });
        } else {
          const contract = await joinFor(v);
          await contract.callTx.closeVault();
        }
        await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, active: false } : x)));
        refreshLeaderboard();
      } catch (e) {
        throw explainTxError(e);
      }
    },
    [vaults, providers, persist, refreshLeaderboard],
  );

  const value: DappValue = {
    phase,
    error,
    wrongNetwork,
    sealAvailable: !!keyRef.current,
    bridgeMode,
    connect,
    vaults,
    vaultById: (id) => vaults.find((v) => v.vaultId === id),
    contractAddress,
    leaderboard,
    refreshLeaderboard,
    mint,
    runEpoch,
    setPrincipal,
    renameVault,
    follow,
    unfollow,
    closeVault,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

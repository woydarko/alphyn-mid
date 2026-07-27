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
      if (key && !v.locked) {
        const part: SecretPart = { secretHex: v.secretHex, nonceHex: v.nonceHex, allocation: v.allocation };
        sealed = await seal(key, part);
      }
      const { secretHex, nonceHex, allocation, locked, ...pub } = v;
      records.push({ ...pub, sealed });
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
    if (v.locked || !v.secretHex) throw new Error('This vault is locked. Reconnect a wallet that can sign to unlock it.');
    return v;
  };

  const refreshLeaderboard = useCallback(async () => {
    if (!providers || !contractAddress) return;
    try {
      setLeaderboard(await readLeaderboard(providers, contractAddress));
    } catch {
      /* ignore */
    }
  }, [providers, contractAddress]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  const mint = useCallback(
    async (s: Strategy, name: string): Promise<LocalVault> => {
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
    },
    [providers, contractAddress, vaults, persist],
  );

  const runEpoch = useCallback(
    async (vaultId: string) => {
      const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
      const contract = await joinFor(v);
      const { up, down } = await fetchOracle();
      await cvRebalance(contract, up.map((x) => BigInt(x)), down.map((x) => BigInt(x)));
      const num = v.allocation.reduce((acc, w, i) => acc + w * up[i] - w * down[i], 0);
      const pnlBps = Math.round(num / 100);
      const updated: LocalVault = { ...v, epochs: [...v.epochs, { n: v.epochs.length + 1, pnlBps, ts: Date.now() }] };
      await persist(vaults.map((x) => (x.vaultId === vaultId ? updated : x)));
      refreshLeaderboard();
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
      const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
      const contract = await joinFor(v);
      await cvFollow(contract, fromHex(targetId.replace(/^0x/, '')), BigInt(pct));
      await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: targetId } : x)));
      refreshLeaderboard();
    },
    [vaults, providers, persist, refreshLeaderboard],
  );
  const unfollow = useCallback(
    async (vaultId: string) => {
      const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
      const contract = await joinFor(v);
      await contract.callTx.unfollow();
      await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, following: null } : x)));
      refreshLeaderboard();
    },
    [vaults, providers, persist, refreshLeaderboard],
  );
  const closeVault = useCallback(
    async (vaultId: string) => {
      const v = requireUnlocked(vaults.find((x) => x.vaultId === vaultId));
      const contract = await joinFor(v);
      await contract.callTx.closeVault();
      await persist(vaults.map((x) => (x.vaultId === vaultId ? { ...x, active: false } : x)));
      refreshLeaderboard();
    },
    [vaults, providers, persist, refreshLeaderboard],
  );

  const value: DappValue = {
    phase,
    error,
    wrongNetwork,
    sealAvailable: !!keyRef.current,
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

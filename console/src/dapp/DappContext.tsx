import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledAlphynContract } from '../alphyn-contract';
import { connectWallet, buildProviders } from '../providers';
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
  principal: number; // notional starting capital (USD)
  createdAt: number;
  epochs: { n: number; pnlBps: number; ts: number }[];
  secretHex: string;
  nonceHex: string;
  following: string | null;
  active: boolean;
}

type Phase = 'connecting' | 'need-wallet' | 'ready';

interface DappValue {
  phase: Phase;
  error: string | null;
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

const LS_VAULTS = 'alphyn.vaults';
const LS_ADDR = 'alphyn.contract';
const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
const bigAlloc = (a: number[]): [bigint, bigint, bigint, bigint] =>
  [BigInt(a[0]), BigInt(a[1]), BigInt(a[2]), BigInt(a[3])];

const loadVaults = (): LocalVault[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_VAULTS) ?? '[]');
  } catch {
    return [];
  }
};

export function DappProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<any>(null);
  const [vaults, setVaults] = useState<LocalVault[]>(loadVaults);
  const [contractAddress, setContractAddress] = useState<string | null>(
    () => localStorage.getItem(LS_ADDR),
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const persist = useCallback((next: LocalVault[]) => {
    setVaults(next);
    localStorage.setItem(LS_VAULTS, JSON.stringify(next));
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setPhase('connecting');
    try {
      const api = await connectWallet();
      const p = await buildProviders(api);
      setProviders(p);
      setPhase('ready');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('need-wallet');
    }
  }, []);

  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const privateStateFor = (v: LocalVault) =>
    createAlphynPrivateState(fromHex(v.secretHex), bigAlloc(v.allocation), fromHex(v.nonceHex));

  const joinFor = async (v: LocalVault) =>
    joinVaultContract(providers, v.contractAddress, privateStateFor(v));

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

      // First vault deploys the contract; later ones join the same address so the
      // dashboard, leaderboard and follow all share one ledger.
      let address = contractAddress;
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
        localStorage.setItem(LS_ADDR, address);
      }

      const before = new Set((await readLeaderboard(providers, address)).map((r) => r.id));
      await cvCreateVault(contract, categoryEnum(s.category), BigInt(s.assetCount));
      const after = await readLeaderboard(providers, address);
      setLeaderboard(after);
      const mineRow = after.find((r) => !before.has(r.id));
      const vaultId = mineRow?.id ?? `local-${Date.now()}`;

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
      persist([...loadVaults(), v]);
      return v;
    },
    [providers, contractAddress, persist],
  );

  const runEpoch = useCallback(
    async (vaultId: string) => {
      const v = loadVaults().find((x) => x.vaultId === vaultId);
      if (!v) return;
      const contract = await joinFor(v);
      // Mild pseudo-random oracle per epoch so notional PnL evolves. Order
      // [USDC, ETH, BTC, ARB]; USDC is the stable leg.
      const r = (n: number) => Math.floor(Math.random() * n);
      const up = [0, r(400), r(250), r(300)];
      const down = [0, r(200), r(200), r(220)];
      await cvRebalance(
        contract,
        up.map((x) => BigInt(x)),
        down.map((x) => BigInt(x)),
      );
      // pnl bps this epoch = (Σ w·up − Σ w·down) / 100  (weights are percents)
      const num = v.allocation.reduce((acc, w, i) => acc + w * up[i] - w * down[i], 0);
      const pnlBps = Math.round(num / 100);
      const updated: LocalVault = {
        ...v,
        epochs: [...v.epochs, { n: v.epochs.length + 1, pnlBps, ts: Date.now() }],
      };
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? updated : x)));
      refreshLeaderboard();
    },
    [providers, persist, refreshLeaderboard],
  );

  const setPrincipal = useCallback(
    (vaultId: string, amount: number) => {
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? { ...x, principal: amount } : x)));
    },
    [persist],
  );

  const renameVault = useCallback(
    (vaultId: string, name: string) => {
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? { ...x, name } : x)));
    },
    [persist],
  );

  const follow = useCallback(
    async (vaultId: string, targetId: string, pct: number) => {
      const v = loadVaults().find((x) => x.vaultId === vaultId);
      if (!v) return;
      const contract = await joinFor(v);
      await cvFollow(contract, fromHex(targetId.replace(/^0x/, '')), BigInt(pct));
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? { ...x, following: targetId } : x)));
      refreshLeaderboard();
    },
    [providers, persist, refreshLeaderboard],
  );

  const unfollow = useCallback(
    async (vaultId: string) => {
      const v = loadVaults().find((x) => x.vaultId === vaultId);
      if (!v) return;
      const contract = await joinFor(v);
      await contract.callTx.unfollow();
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? { ...x, following: null } : x)));
      refreshLeaderboard();
    },
    [providers, persist, refreshLeaderboard],
  );

  const closeVault = useCallback(
    async (vaultId: string) => {
      const v = loadVaults().find((x) => x.vaultId === vaultId);
      if (!v) return;
      const contract = await joinFor(v);
      await contract.callTx.closeVault();
      persist(loadVaults().map((x) => (x.vaultId === vaultId ? { ...x, active: false } : x)));
      refreshLeaderboard();
    },
    [providers, persist, refreshLeaderboard],
  );

  const value: DappValue = {
    phase,
    error,
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

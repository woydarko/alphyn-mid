// Full contract interaction for the console: join a deployed vault contract and
// call its circuits (createVault / rebalance / follow), plus read the public
// leaderboard from the ledger. All private data (allocation, secret) stays in
// the browser as witness/private state.

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { CompiledAlphynContract } from './alphyn-contract';
import { ledger, Category } from './managed/alphyn/contract/index.js';
import type { AlphynPrivateState } from './witnesses';

export const PRIVATE_STATE_ID = 'alphynPrivateState';

export type DeployedAlphyn = Awaited<ReturnType<typeof findDeployedContract>>;

// Asset order matches the contract: [USDC, ETH, BTC, ARB].
export const ASSETS = ['USDC', 'ETH', 'BTC', 'ARB'] as const;

/** Deterministic allocation from a risk level 1..5 (no server/AI needed in-browser). */
export function allocationForRisk(risk: number): [bigint, bigint, bigint, bigint] {
  const table: Record<number, [number, number, number, number]> = {
    1: [70, 20, 10, 0],
    2: [55, 25, 15, 5],
    3: [35, 35, 25, 5],
    4: [20, 40, 30, 10],
    5: [10, 45, 30, 15],
  };
  const a = table[Math.min(5, Math.max(1, Math.round(risk)))];
  return [BigInt(a[0]), BigInt(a[1]), BigInt(a[2]), BigInt(a[3])];
}

export const categoryForRisk = (risk: number): Category =>
  risk <= 2 ? Category.conservative : risk === 3 ? Category.balanced : Category.aggressive;

export async function joinVaultContract(
  providers: any,
  contractAddress: string,
  privateState: AlphynPrivateState,
): Promise<DeployedAlphyn> {
  return findDeployedContract(providers, {
    contractAddress,
    compiledContract: CompiledAlphynContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
}

export async function createVault(contract: any, category: Category, assetCount: bigint) {
  return contract.callTx.createVault(category, assetCount);
}

export async function rebalance(contract: any, upBps: bigint[], downBps: bigint[]) {
  return contract.callTx.rebalance(upBps, downBps);
}

export async function follow(contract: any, targetId: Uint8Array, pct: bigint) {
  return contract.callTx.follow(targetId, pct);
}

export interface LeaderboardRow {
  id: string;
  category: number;
  assetCount: bigint;
  epochCount: bigint;
  netPnlScaled: bigint; // gain - loss (÷100 for true bps)
  followers: bigint;
  active: boolean;
}

/** Read the PUBLIC ledger - aggregate stats only; never any allocation. */
export async function readLeaderboard(providers: any, contractAddress: string): Promise<LeaderboardRow[]> {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) return [];
  const l = ledger(state.data);
  const rows: LeaderboardRow[] = [];
  for (const [id, v] of l.vaults) {
    rows.push({
      id: toHex(id),
      category: v.category,
      assetCount: v.assetCount,
      epochCount: v.epochCount,
      netPnlScaled: v.gainScaled - v.lossScaled,
      followers: v.followers,
      active: v.active,
    });
  }
  return rows;
}

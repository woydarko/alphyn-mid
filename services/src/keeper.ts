// Keeper / epoch runner — the autonomous loop that advances a vault each epoch.
//
// The orchestration here is SDK-version-independent: it depends only on a small
// `VaultContract` interface (the `callTx.*` surface that midnight-js generates
// for a deployed contract). The concrete deployed-contract handle is injected by
// the deploy layer (`deploy.ts`) at run time, so this logic is fully testable
// without any wallet or chain — see keeper.test.ts.
//
// Per epoch: pull prices → compute unsigned up/down bps vs the last epoch's
// prices → call the `rebalance` circuit (which ZK-proves the PnL followed the
// committed allocation) → keep the new prices as the next baseline.

import { computeReturns, fetchPrices, type PriceVector } from './priceFeed.js';

/** The subset of a deployed midnight-js contract handle the keeper needs. */
export interface VaultContract {
  callTx: {
    rebalance(upBps: bigint[], downBps: bigint[]): Promise<unknown>;
  };
}

export interface EpochResult {
  prices: PriceVector;
  upBps: [bigint, bigint, bigint, bigint];
  downBps: [bigint, bigint, bigint, bigint];
  skipped: boolean;
}

/**
 * Run a single epoch. `prevPrices` is the baseline from the previous epoch
 * (undefined on the very first call — then we only record prices, no rebalance).
 * `getPrices` is injectable for testing.
 */
export async function runEpoch(
  contract: VaultContract,
  prevPrices: PriceVector | undefined,
  getPrices: () => Promise<PriceVector> = fetchPrices,
): Promise<EpochResult> {
  const prices = await getPrices();

  if (!prevPrices) {
    // First observation — establish the baseline, nothing to prove yet.
    return { prices, upBps: [0n, 0n, 0n, 0n], downBps: [0n, 0n, 0n, 0n], skipped: true };
  }

  const { upBps, downBps } = computeReturns(prevPrices, prices);
  await contract.callTx.rebalance([...upBps], [...downBps]);
  return { prices, upBps, downBps, skipped: false };
}

export interface KeeperOptions {
  intervalMs?: number;
  getPrices?: () => Promise<PriceVector>;
  /** Stops the loop when it returns true (defaults to never). */
  shouldStop?: () => boolean;
  onEpoch?: (r: EpochResult) => void;
}

/**
 * Start the recurring keeper loop. Returns a stop() function. The first tick
 * only records a price baseline; subsequent ticks submit a rebalance.
 */
export function startKeeper(contract: VaultContract, opts: KeeperOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? Number(process.env.EPOCH_INTERVAL_SECONDS ?? 3600) * 1000;
  let prev: PriceVector | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    if (stopped || opts.shouldStop?.()) return;
    try {
      const result = await runEpoch(contract, prev, opts.getPrices);
      prev = result.prices;
      opts.onEpoch?.(result);
    } catch (err) {
      console.error('[keeper] epoch failed:', (err as Error).message);
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

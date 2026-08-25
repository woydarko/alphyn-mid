import { describe, it, expect, vi } from 'vitest';
import { runEpoch, type VaultContract } from '../src/keeper.js';
import type { PriceVector } from '../src/priceFeed.js';

function mockContract() {
  const calls: { upBps: bigint[]; downBps: bigint[] }[] = [];
  const contract: VaultContract = {
    callTx: {
      rebalance: async (upBps: bigint[], downBps: bigint[]) => {
        calls.push({ upBps, downBps });
      },
    },
  };
  return { contract, calls };
}

describe('keeper — epoch orchestration', () => {
  it('first epoch only records a baseline (no rebalance)', async () => {
    const { contract, calls } = mockContract();
    const prices: PriceVector = [1, 2000, 50000, 1.2];
    const r = await runEpoch(contract, undefined, async () => prices);
    expect(r.skipped).toBe(true);
    expect(r.prices).toEqual(prices);
    expect(calls.length).toBe(0);
  });

  it('subsequent epoch computes returns and submits a rebalance', async () => {
    const { contract, calls } = mockContract();
    const prev: PriceVector = [1, 2000, 50000, 1.2];
    const cur: PriceVector = [1, 2060, 49500, 1.2]; // ADA +3%, NIGHT -1%
    const r = await runEpoch(contract, prev, async () => cur);
    expect(r.skipped).toBe(false);
    expect(calls.length).toBe(1);
    expect(calls[0].upBps).toEqual([0n, 300n, 0n, 0n]);
    expect(calls[0].downBps).toEqual([0n, 0n, 100n, 0n]);
  });

  it('propagates contract errors so the loop can catch them', async () => {
    const contract: VaultContract = {
      callTx: { rebalance: async () => { throw new Error('proof failed'); } },
    };
    await expect(
      runEpoch(contract, [1, 2000, 50000, 1.2], async () => [1, 2100, 50000, 1.2]),
    ).rejects.toThrow('proof failed');
  });
});

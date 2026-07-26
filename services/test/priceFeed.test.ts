import { describe, it, expect } from 'vitest';
import { computeReturns, type PriceVector } from '../src/priceFeed.js';

describe('price feed — return computation', () => {
  it('splits gains into upBps and keeps USDC flat', () => {
    const prev: PriceVector = [1, 2000, 50000, 1.0];
    const cur: PriceVector = [1, 2060, 50000, 1.0]; // ETH +3%
    const { upBps, downBps } = computeReturns(prev, cur);
    expect(upBps).toEqual([0n, 300n, 0n, 0n]);
    expect(downBps).toEqual([0n, 0n, 0n, 0n]);
  });

  it('splits losses into downBps', () => {
    const prev: PriceVector = [1, 2000, 50000, 1.2];
    const cur: PriceVector = [1, 2000, 49500, 1.14]; // BTC -1%, ARB -5%
    const { upBps, downBps } = computeReturns(prev, cur);
    expect(upBps).toEqual([0n, 0n, 0n, 0n]);
    expect(downBps).toEqual([0n, 0n, 100n, 500n]);
  });

  it('handles mixed moves and never marks an asset both up and down', () => {
    const prev: PriceVector = [1, 2000, 50000, 1.0];
    const cur: PriceVector = [1, 2040, 49000, 1.1]; // ETH +2%, BTC -2%, ARB +10%
    const { upBps, downBps } = computeReturns(prev, cur);
    expect(upBps).toEqual([0n, 200n, 0n, 1000n]);
    expect(downBps).toEqual([0n, 0n, 200n, 0n]);
    for (let i = 0; i < 4; i++) expect(upBps[i] === 0n || downBps[i] === 0n).toBe(true);
  });
});

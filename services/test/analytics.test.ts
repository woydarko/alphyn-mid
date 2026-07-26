import { describe, it, expect } from 'vitest';
import { netPnlBps, avgPnlPerEpochBps, sharpe, maxDrawdownBps, summarizeVault } from '../src/analytics.js';

describe('analytics', () => {
  it('net PnL = (gain - loss) / 100', () => {
    expect(netPnlBps({ gainScaled: 18000n, lossScaled: 2000n, epochCount: 2n })).toBe(160);
  });

  it('avg PnL per epoch', () => {
    expect(avgPnlPerEpochBps({ gainScaled: 18000n, lossScaled: 2000n, epochCount: 2n })).toBe(80);
    expect(avgPnlPerEpochBps({ gainScaled: 0n, lossScaled: 0n, epochCount: 0n })).toBe(0);
  });

  it('sharpe = mean/stddev of epoch returns', () => {
    // returns [100, 100, 100] -> stddev 0 -> guarded to 0
    expect(sharpe([100, 100, 100])).toBe(0);
    // returns [200, 100, 300] -> mean 200, sample std 100 -> sharpe 2
    expect(sharpe([200, 100, 300])).toBeCloseTo(2, 5);
    expect(sharpe([50])).toBe(0); // needs >= 2 points
  });

  it('max drawdown from cumulative series', () => {
    // cumulative [100, 60, 90, 40] -> peak 100, trough 40 -> dd 60
    expect(maxDrawdownBps([100, 60, 90, 40])).toBe(60);
    expect(maxDrawdownBps([10, 20, 30])).toBe(0); // monotonic up
  });

  it('summarizeVault combines on-chain aggregate + epoch return series', () => {
    const s = summarizeVault({ gainScaled: 30000n, lossScaled: 10000n, epochCount: 3n }, [180, -20, 40]);
    expect(s.netPnlBps).toBe(200);
    expect(s.avgPnlPerEpochBps).toBeCloseTo(200 / 3, 5);
    expect(typeof s.sharpe).toBe('number');
    expect(s.maxDrawdownBps).toBeGreaterThanOrEqual(0);
  });
});

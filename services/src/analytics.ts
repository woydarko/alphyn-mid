// Off-chain analytics derived from the public ledger + keeper-recorded epoch
// returns. The contract exposes only aggregate gain/loss (unsigned, ×100); net
// PnL and Sharpe are computed here so nothing sensitive lives on-chain.

export interface VaultAggregate {
  gainScaled: bigint; // Σ over epochs of Σ_i weight_i·upBps_i
  lossScaled: bigint; // Σ over epochs of Σ_i weight_i·downBps_i
  epochCount: bigint;
}

/** Net PnL in basis points: (gain − loss) ÷ 100 (the ×100 alloc-weight scale). */
export function netPnlBps(v: VaultAggregate): number {
  return Number(v.gainScaled - v.lossScaled) / 100;
}

/** Average PnL per epoch, in bps. */
export function avgPnlPerEpochBps(v: VaultAggregate): number {
  const n = Number(v.epochCount);
  return n === 0 ? 0 : netPnlBps(v) / n;
}

/**
 * Sharpe ratio from a series of per-epoch returns (bps). Sharpe = mean / stddev.
 * The per-epoch series must be recorded by the keeper each epoch (the ledger
 * only stores cumulative gain/loss, which has no variance information).
 * @param riskFreeBps per-epoch risk-free return (default 0 for testnet)
 */
export function sharpe(epochReturnsBps: number[], riskFreeBps = 0): number {
  const n = epochReturnsBps.length;
  if (n < 2) return 0;
  const excess = epochReturnsBps.map((r) => r - riskFreeBps);
  const mean = excess.reduce((s, r) => s + r, 0) / n;
  const variance = excess.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : mean / std;
}

/** Max drawdown (bps) from a cumulative-PnL series. */
export function maxDrawdownBps(cumulativePnlBps: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of cumulativePnlBps) {
    peak = Math.max(peak, v);
    maxDd = Math.max(maxDd, peak - v);
  }
  return maxDd;
}

export interface VaultSummary {
  netPnlBps: number;
  avgPnlPerEpochBps: number;
  sharpe: number;
  maxDrawdownBps: number;
}

/** Full summary given the on-chain aggregate + keeper-recorded per-epoch returns. */
export function summarizeVault(v: VaultAggregate, epochReturnsBps: number[] = []): VaultSummary {
  const cumulative: number[] = [];
  let acc = 0;
  for (const r of epochReturnsBps) { acc += r; cumulative.push(acc); }
  return {
    netPnlBps: netPnlBps(v),
    avgPnlPerEpochBps: avgPnlPerEpochBps(v),
    sharpe: sharpe(epochReturnsBps),
    maxDrawdownBps: maxDrawdownBps(cumulative),
  };
}

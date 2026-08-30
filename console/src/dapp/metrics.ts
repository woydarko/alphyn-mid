import type { LocalVault } from './DappContext';

// Vault metrics over REAL custody. `principal` is the vault's on-chain custodied
// tNIGHT (native base units); PnL is proven per epoch on-chain and applied to it.

export const netPnlBps = (v: LocalVault): number => v.epochs.reduce((s, e) => s + e.pnlBps, 0);

export const navTNight = (v: LocalVault): number => v.principal * (1 + netPnlBps(v) / 10000);

export const pnlTNight = (v: LocalVault): number => navTNight(v) - v.principal;

export const sharpe = (v: LocalVault): number => {
  const xs = v.epochs.map((e) => e.pnlBps);
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : mean / sd;
};

export const maxDrawdownBps = (v: LocalVault): number => {
  let peak = 0;
  let cum = 0;
  let maxDd = 0;
  for (const e of v.epochs) {
    cum += e.pnlBps;
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
  }
  return maxDd;
};

// Cumulative-PnL series for the performance chart.
export const pnlSeries = (v: LocalVault): { n: number; cumBps: number; ts: number }[] => {
  let cum = 0;
  return v.epochs.map((e) => {
    cum += e.pnlBps;
    return { n: e.n, cumBps: cum, ts: e.ts };
  });
};

export const CATEGORY_STYLES: Record<string, string> = {
  conservative: 'bg-green-500/15 text-green-400 border-green-500/30',
  balanced: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  aggressive: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

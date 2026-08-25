// Browser strategy engine: questionnaire -> allocation vector.
//
// Ported from services/src/strategy.ts for in-browser use. The output allocation
// is the user's PRIVATE strategy: it becomes witness data and never touches the
// chain in plaintext, only its commitment does. Asset order is FIXED and matches
// alphyn.compact: [DJED, ADA, NIGHT, SNEK].
//
// If an OpenRouter key is present (VITE_OPENROUTER_API_KEY or the localStorage
// key "alphyn-openrouter-key") the questionnaire is sent to the model. Otherwise
// a deterministic local engine runs, so the flow works with no key, offline, and
// with nothing leaving the browser.

export const ASSETS = ['DJED', 'ADA', 'NIGHT', 'SNEK'] as const;
export type Asset = (typeof ASSETS)[number];

export type Horizon = 'short' | 'mid' | 'long';
export type ApyBand = 'low' | 'mid' | 'high';
export type Drawdown = '5' | '10' | '20' | 'unlimited';
export type Category = 'conservative' | 'balanced' | 'aggressive';

export interface Questionnaire {
  riskLevel: number; // 1..5
  horizon: Horizon;
  assets: Asset[]; // subset the user is willing to hold
  targetApy: ApyBand;
  maxDrawdown: Drawdown;
  vaultName?: string;
  description?: string; // free-text "own words"
}

export interface Strategy {
  /** Percentages per asset [DJED, ADA, NIGHT, SNEK], integers summing to 100. */
  allocation: [number, number, number, number];
  category: Category;
  assetCount: number; // count of non-zero weights (1..4)
  rebalanceTriggerPct: number;
  stopLossPct: number;
  epochDurationSeconds: number;
  maxSlippageBps: number;
  source: 'ai' | 'local'; // where the weights came from
}

interface RawStrategy {
  allocations: Partial<Record<Asset, number>>;
  rebalance_trigger_pct: number;
  stop_loss_pct: number;
  epoch_duration_seconds: number;
  max_slippage_bps: number;
}

// Deterministic local engine: shapes weights from the structured answers so the
// flow works with no API key. Fully private, nothing leaves the browser.
function localStrategy(q: Questionnaire): RawStrategy {
  const aggressive = q.riskLevel >= 4;
  let base: Record<Asset, number> = aggressive
    ? { DJED: 10, ADA: 45, NIGHT: 30, SNEK: 15 }
    : q.riskLevel <= 2
      ? { DJED: 60, ADA: 25, NIGHT: 15, SNEK: 0 }
      : { DJED: 35, ADA: 35, NIGHT: 25, SNEK: 5 };

  // Longer horizon leans a little more into growth assets.
  if (q.horizon === 'long') base = { ...base, DJED: Math.max(0, base.DJED - 10), ADA: base.ADA + 10 };
  if (q.horizon === 'short') base = { ...base, DJED: base.DJED + 10, SNEK: Math.max(0, base.SNEK - 5), NIGHT: Math.max(0, base.NIGHT - 5) };

  // A tighter drawdown tolerance shifts weight to the stable asset.
  if (q.maxDrawdown === '5') base = { ...base, DJED: base.DJED + 15, ADA: Math.max(0, base.ADA - 10), SNEK: Math.max(0, base.SNEK - 5) };

  return {
    allocations: base,
    rebalance_trigger_pct: aggressive ? 8 : q.riskLevel <= 2 ? 3 : 4,
    stop_loss_pct: aggressive ? 20 : q.riskLevel <= 2 ? 8 : 12,
    epoch_duration_seconds: q.horizon === 'short' ? 1800 : q.horizon === 'long' ? 21600 : 3600,
    max_slippage_bps: 50,
  };
}

// SECURITY: no AI API key ever runs in the browser. A client-side OpenRouter call
// would bake the key into the public bundle (or expose it via localStorage/XSS) and
// leak the questionnaire to a third party. Strategy generation therefore runs fully
// locally and privately. If real AI is wanted, it must go through a backend proxy
// that holds the key server-side; the client keeps calling this same function.
async function callStrategyEngine(q: Questionnaire): Promise<RawStrategy> {
  return localStrategy(q);
}

/** Zero out disallowed assets and renormalize weights to integers summing to 100. */
export function normalizeAllocation(
  raw: Partial<Record<Asset, number>>,
  allowed: Asset[],
): [number, number, number, number] {
  const allow = new Set(allowed);
  const vals = ASSETS.map((a) => (allow.has(a) ? Math.max(0, raw[a] ?? 0) : 0));
  const sum = vals.reduce((s, v) => s + v, 0);
  if (sum <= 0) throw new Error('allocation is empty after filtering allowed assets');
  const scaled = vals.map((v) => Math.round((v * 100) / sum));
  const drift = 100 - scaled.reduce((s, v) => s + v, 0);
  const maxIdx = scaled.indexOf(Math.max(...scaled));
  scaled[maxIdx] += drift;
  return scaled as [number, number, number, number];
}

export const deriveCategory = (riskLevel: number): Category =>
  riskLevel <= 2 ? 'conservative' : riskLevel === 3 ? 'balanced' : 'aggressive';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export async function generateStrategy(q: Questionnaire): Promise<Strategy> {
  if (q.riskLevel < 1 || q.riskLevel > 5) throw new Error('riskLevel must be 1..5');
  if (q.assets.length === 0) throw new Error('at least one asset required');

  const raw = await callStrategyEngine(q);
  const allocation = normalizeAllocation(raw.allocations, q.assets);
  const assetCount = allocation.filter((w) => w > 0).length;

  return {
    allocation,
    category: deriveCategory(q.riskLevel),
    assetCount,
    rebalanceTriggerPct: clamp(raw.rebalance_trigger_pct, 1, 20),
    stopLossPct: clamp(raw.stop_loss_pct, 2, 30),
    epochDurationSeconds: clamp(raw.epoch_duration_seconds, 300, 86400),
    maxSlippageBps: clamp(raw.max_slippage_bps, 10, 200),
    source: 'local',
  };
}

/** Cryptographically random 32 bytes in the browser. */
export const rand32 = (): Uint8Array => {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return a;
};

/** Allocation as the bigint vector the contract witness expects. */
export const allocationBigints = (s: Strategy): [bigint, bigint, bigint, bigint] =>
  s.allocation.map((w) => BigInt(w)) as [bigint, bigint, bigint, bigint];

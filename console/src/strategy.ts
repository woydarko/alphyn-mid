// Browser strategy engine: questionnaire -> allocation vector.
//
// Ported from services/src/strategy.ts for in-browser use. The output allocation
// is the user's PRIVATE strategy: it becomes witness data and never touches the
// chain in plaintext, only its commitment does. Asset order is FIXED and matches
// alphyn.compact: [USDC, ETH, BTC, ARB].
//
// If an OpenRouter key is present (VITE_OPENROUTER_API_KEY or the localStorage
// key "alphyn-openrouter-key") the questionnaire is sent to the model. Otherwise
// a deterministic local engine runs, so the flow works with no key, offline, and
// with nothing leaving the browser.

export const ASSETS = ['USDC', 'ETH', 'BTC', 'ARB'] as const;
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
  /** Percentages per asset [USDC, ETH, BTC, ARB], integers summing to 100. */
  allocation: [number, number, number, number];
  category: Category;
  assetCount: number; // count of non-zero weights (1..4)
  rebalanceTriggerPct: number;
  stopLossPct: number;
  epochDurationSeconds: number;
  maxSlippageBps: number;
  source: 'ai' | 'local'; // where the weights came from
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT =
  'You are a DeFi portfolio strategy engine. Respond ONLY with valid JSON. ' +
  'No preamble, no explanation, no markdown. Raw JSON only. Schema: ' +
  '{ "allocations": { "USDC": number, "ETH": number, "BTC": number, "ARB": number }, ' +
  '"rebalance_trigger_pct": number, "stop_loss_pct": number, ' +
  '"epoch_duration_seconds": number, "max_slippage_bps": number }. ' +
  'Rules: allocations must sum to exactly 100 and use ONLY the allowed assets ' +
  '(set others to 0). rebalance_trigger_pct 1-20, stop_loss_pct 2-30, ' +
  'epoch_duration_seconds 300-86400, max_slippage_bps 10-200.';

function buildUserPrompt(q: Questionnaire): string {
  const own = q.description ? `User's own words: "${q.description}"\n\n` : '';
  return (
    `${own}Generate a portfolio strategy with these constraints: ` +
    `risk_level=${q.riskLevel} (1-5), time_horizon=${q.horizon}, ` +
    `allowed_assets=${JSON.stringify(q.assets)}, target_apy=${q.targetApy}, ` +
    `max_drawdown=${q.maxDrawdown}. Honor the user's own words when shaping ` +
    `weights but stay within the constraints. Return only valid JSON.`
  );
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
    ? { USDC: 10, ETH: 45, BTC: 30, ARB: 15 }
    : q.riskLevel <= 2
      ? { USDC: 60, ETH: 25, BTC: 15, ARB: 0 }
      : { USDC: 35, ETH: 35, BTC: 25, ARB: 5 };

  // Longer horizon leans a little more into growth assets.
  if (q.horizon === 'long') base = { ...base, USDC: Math.max(0, base.USDC - 10), ETH: base.ETH + 10 };
  if (q.horizon === 'short') base = { ...base, USDC: base.USDC + 10, ARB: Math.max(0, base.ARB - 5), BTC: Math.max(0, base.BTC - 5) };

  // A tighter drawdown tolerance shifts weight to the stable asset.
  if (q.maxDrawdown === '5') base = { ...base, USDC: base.USDC + 15, ETH: Math.max(0, base.ETH - 10), ARB: Math.max(0, base.ARB - 5) };

  return {
    allocations: base,
    rebalance_trigger_pct: aggressive ? 8 : q.riskLevel <= 2 ? 3 : 4,
    stop_loss_pct: aggressive ? 20 : q.riskLevel <= 2 ? 8 : 12,
    epoch_duration_seconds: q.horizon === 'short' ? 1800 : q.horizon === 'long' ? 21600 : 3600,
    max_slippage_bps: 50,
  };
}

function readKey(): string | undefined {
  const env = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('alphyn-openrouter-key') ?? undefined : undefined;
  return env || stored || undefined;
}

async function callOpenRouter(q: Questionnaire): Promise<RawStrategy> {
  const key = readKey();
  if (!key) return localStrategy(q);
  const model = (import.meta as any).env?.VITE_OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'https://alphyn.app',
      'X-Title': 'Alphyn',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(q) },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('OpenRouter returned no JSON.');
  return JSON.parse(match[0]) as RawStrategy;
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

  const usingAi = !!readKey();
  const raw = await callOpenRouter(q);
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
    source: usingAi ? 'ai' : 'local',
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

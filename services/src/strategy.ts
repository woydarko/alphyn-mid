// Strategy generation — questionnaire → OpenRouter → allocation vector.
//
// Ported from the original ChainGPT engine. The output allocation is the user's
// PRIVATE strategy: it becomes witness data (AlphynPrivateState.allocation) and
// is never sent to the chain in plaintext — only its commitment is.
//
// Asset order is FIXED and matches alphyn.compact: [USDC, ETH, BTC, ARB].

import { randomBytes } from 'node:crypto';

export const ASSETS = ['USDC', 'ETH', 'BTC', 'ARB'] as const;
export type Asset = (typeof ASSETS)[number];

export type Horizon = 'short' | 'mid' | 'long';
export type ApyBand = 'low' | 'mid' | 'high';
export type Drawdown = '5' | '10' | '20' | 'unlimited';
export type Category = 'conservative' | 'balanced' | 'aggressive';

export interface Questionnaire {
  riskLevel: number;          // 1..5
  horizon: Horizon;
  assets: Asset[];            // subset the user is willing to hold
  targetApy: ApyBand;
  maxDrawdown: Drawdown;
  description?: string;       // free-text "own words"
}

export interface Strategy {
  /** Percentages per asset [USDC, ETH, BTC, ARB], integers summing to 100. */
  allocation: [number, number, number, number];
  category: Category;
  assetCount: number;         // count of non-zero weights (1..4)
  rebalanceTriggerPct: number;
  stopLossPct: number;
  epochDurationSeconds: number;
  maxSlippageBps: number;
}

/** Private state shape consumed by the contract witnesses. */
export interface PrivateState {
  secretKey: Uint8Array;                                   // Bytes<32>
  allocation: [bigint, bigint, bigint, bigint];            // Vector<4,Uint<8>>
  nonce: Uint8Array;                                       // Bytes<32>
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

// Deterministic mock so the flow works with no API key (dev / CI / demo fallback).
function mockStrategy(q: Questionnaire): RawStrategy {
  const aggressive = q.riskLevel >= 4;
  const base: Record<Asset, number> = aggressive
    ? { USDC: 10, ETH: 45, BTC: 30, ARB: 15 }
    : q.riskLevel <= 2
      ? { USDC: 60, ETH: 25, BTC: 15, ARB: 0 }
      : { USDC: 35, ETH: 35, BTC: 25, ARB: 5 };
  return {
    allocations: base,
    rebalance_trigger_pct: aggressive ? 8 : 4,
    stop_loss_pct: aggressive ? 20 : 10,
    epoch_duration_seconds: 3600,
    max_slippage_bps: 50,
  };
}

async function callOpenRouter(q: Questionnaire): Promise<RawStrategy> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn('[strategy] OPENROUTER_API_KEY missing — using deterministic mock.');
    return mockStrategy(q);
  }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
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
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`OpenRouter returned no JSON. Raw: ${text.slice(0, 200)}`);
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
  // fix rounding drift onto the largest weight
  const drift = 100 - scaled.reduce((s, v) => s + v, 0);
  const maxIdx = scaled.indexOf(Math.max(...scaled));
  scaled[maxIdx] += drift;
  return scaled as [number, number, number, number];
}

function deriveCategory(riskLevel: number): Category {
  return riskLevel <= 2 ? 'conservative' : riskLevel === 3 ? 'balanced' : 'aggressive';
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export async function generateStrategy(q: Questionnaire): Promise<Strategy> {
  if (q.riskLevel < 1 || q.riskLevel > 5) throw new Error('riskLevel must be 1..5');
  if (q.assets.length === 0) throw new Error('at least one asset required');

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
  };
}

/** Build fresh private state from a strategy: random secret + nonce, allocation as bigints. */
export function toPrivateState(strategy: Strategy): PrivateState {
  return {
    secretKey: new Uint8Array(randomBytes(32)),
    nonce: new Uint8Array(randomBytes(32)),
    allocation: strategy.allocation.map((w) => BigInt(w)) as [bigint, bigint, bigint, bigint],
  };
}

/** Category → Compact enum ordinal (matches `export enum Category`). */
export const categoryOrdinal = (c: Category): number =>
  c === 'conservative' ? 0 : c === 'balanced' ? 1 : 2;

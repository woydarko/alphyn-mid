import { z } from 'zod';
import { NextResponse } from 'next/server';

// Strategy generation via OpenRouter (replaces ChainGPT + iExec Nox + Prisma).
//
// The allocation is returned to the CLIENT, which turns it into private witness
// state and commits only a hash on-chain. It is never written to any ledger in
// plaintext. The OpenRouter key stays server-side.

const RequestSchema = z.object({
  riskLevel: z.number().int().min(1).max(5),
  horizon: z.enum(['short', 'mid', 'long']),
  assets: z.array(z.enum(['ETH', 'USDC', 'ARB', 'WBTC'])).min(1).max(4),
  targetApy: z.enum(['low', 'mid', 'high']),
  maxDrawdown: z.enum(['5', '10', '20', 'unlimited']),
  vaultName: z.string().trim().max(40).optional(),
  description: z.string().trim().max(280).optional(),
});

type Asset = 'ETH' | 'USDC' | 'ARB' | 'WBTC';
const ALL: Asset[] = ['ETH', 'USDC', 'ARB', 'WBTC'];

const SYSTEM =
  'You are a DeFi portfolio strategy engine. Respond ONLY with valid JSON, no ' +
  'markdown. Schema: { "allocations": { "ETH": n, "USDC": n, "ARB": n, "WBTC": n }, ' +
  '"rebalance_trigger_pct": n, "stop_loss_pct": n, "epoch_duration_seconds": n, ' +
  '"max_slippage_bps": n }. allocations must sum to 100 using only the allowed ' +
  'assets (others 0). trigger 1-20, stop_loss 2-30, epoch 300-86400, slippage 10-200.';

function mock(assets: Asset[]) {
  const per = Math.floor(100 / assets.length);
  const alloc: Record<Asset, number> = { ETH: 0, USDC: 0, ARB: 0, WBTC: 0 };
  assets.forEach((a, i) => (alloc[a] = i === 0 ? 100 - per * (assets.length - 1) : per));
  return { allocations: alloc, rebalance_trigger_pct: 5, stop_loss_pct: 10, epoch_duration_seconds: 3600, max_slippage_bps: 50 };
}

async function callOpenRouter(userPrompt: string, assets: Asset[]): Promise<any> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn('[strategy] OPENROUTER_API_KEY missing - using mock.');
    return mock(assets);
  }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`OpenRouter returned no JSON. Raw: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

export async function POST(req: Request) {
  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });

    const { riskLevel, horizon, assets, targetApy, maxDrawdown, description } = parsed.data;
    const own = description ? `User's own words: "${description}"\n\n` : '';
    const prompt = `${own}Generate a rebalancing strategy: risk_level=${riskLevel} (1-5), time_horizon=${horizon}, preferred_assets=${JSON.stringify(assets)}, target_apy=${targetApy}, max_drawdown=${maxDrawdown}. Only valid JSON.`;

    const raw = await callOpenRouter(prompt, assets);

    // Zero disallowed assets, renormalize to exactly 100.
    const allow = new Set(assets);
    const alloc: Record<Asset, number> = { ETH: 0, USDC: 0, ARB: 0, WBTC: 0 };
    for (const a of ALL) alloc[a] = allow.has(a) ? Math.max(0, Number(raw?.allocations?.[a] ?? 0)) : 0;
    const sum = ALL.reduce((s, a) => s + alloc[a], 0);
    if (sum <= 0) return NextResponse.json({ error: 'empty allocation' }, { status: 500 });
    for (const a of ALL) alloc[a] = Math.round((alloc[a] * 100) / sum);
    const drift = 100 - ALL.reduce((s, a) => s + alloc[a], 0);
    const top = ALL.reduce((m, a) => (alloc[a] > alloc[m] ? a : m), ALL[0]);
    alloc[top] += drift;

    const assetCount = ALL.filter((a) => alloc[a] > 0).length;
    const category = riskLevel <= 2 ? 'conservative' : riskLevel === 3 ? 'balanced' : 'aggressive';

    return NextResponse.json({
      allocations: alloc,
      category,
      assetCount,
      rebalanceTriggerPct: Number(raw?.rebalance_trigger_pct ?? 5),
      stopLossPct: Number(raw?.stop_loss_pct ?? 10),
      epochDurationSeconds: Number(raw?.epoch_duration_seconds ?? 3600),
      maxSlippageBps: Number(raw?.max_slippage_bps ?? 50),
    });
  } catch (e: any) {
    console.error('STRATEGY GENERATION FAILURE:', e?.message || e);
    return NextResponse.json({ error: 'Strategy generation failed', details: e?.message }, { status: 500 });
  }
}

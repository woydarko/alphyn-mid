// Price-feed adapter. Supplies the PUBLIC oracle inputs to the `rebalance`
// circuit: per-asset positive/negative price return this epoch, in basis points.
//
// Asset order matches alphyn.compact: [DJED, ADA, NIGHT, SNEK]. DJED is a Cardano
// stablecoin, treated as the stable numéraire (0 return). Returns are split into
// two unsigned vectors because Compact has no signed integers — an asset
// contributes to at most one.

import { ASSETS } from './strategy.js';

export type PriceVector = [number, number, number, number]; // USD price per asset

export interface EpochReturns {
  upBps: [bigint, bigint, bigint, bigint];
  downBps: [bigint, bigint, bigint, bigint];
}

// CoinGecko ids for the non-stable assets (index 1..3).
const COINGECKO_IDS: Record<string, string> = {
  ADA: 'cardano',
  NIGHT: 'midnight-3',
  SNEK: 'snek',
};

/** Fetch current USD prices as a PriceVector. DJED (stablecoin) is pinned to 1. */
export async function fetchPrices(baseUrl = process.env.PRICE_FEED_URL ?? 'https://api.coingecko.com/api/v3'): Promise<PriceVector> {
  const ids = [COINGECKO_IDS.ADA, COINGECKO_IDS.NIGHT, COINGECKO_IDS.SNEK].join(',');
  const res = await fetch(`${baseUrl}/simple/price?ids=${ids}&vs_currencies=usd`);
  if (!res.ok) throw new Error(`price feed error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Record<string, { usd: number }>;
  const px = (id: string): number => {
    const v = data[id]?.usd;
    if (typeof v !== 'number' || v <= 0) throw new Error(`missing/invalid price for ${id}`);
    return v;
  };
  return [1, px(COINGECKO_IDS.ADA), px(COINGECKO_IDS.NIGHT), px(COINGECKO_IDS.SNEK)];
}

/**
 * Pure: compute per-asset returns between two price vectors, split into unsigned
 * up/down basis-point vectors ready to feed `rebalance(upBps, downBps)`.
 */
export function computeReturns(prev: PriceVector, cur: PriceVector): EpochReturns {
  const up: bigint[] = [0n, 0n, 0n, 0n];
  const down: bigint[] = [0n, 0n, 0n, 0n];
  for (let i = 0; i < ASSETS.length; i++) {
    const p = prev[i];
    const c = cur[i];
    if (p <= 0) continue; // no baseline yet or stable DJED
    const bps = Math.round(((c - p) / p) * 10_000);
    if (bps > 0) up[i] = BigInt(bps);
    else if (bps < 0) down[i] = BigInt(-bps);
  }
  return {
    upBps: up as [bigint, bigint, bigint, bigint],
    downBps: down as [bigint, bigint, bigint, bigint],
  };
}

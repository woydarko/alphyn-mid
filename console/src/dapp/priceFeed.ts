// Oracle input for an epoch. Asset order is fixed: [DJED, ADA, NIGHT, SNEK].
//
// SECURITY NOTE: the contract accepts upBps/downBps as public parameters and cannot
// itself verify they are truthful — so a modified client could still submit fake
// returns to inflate its public leaderboard PnL. A fully trustless leaderboard needs
// a signed price attestation the circuit checks (a keeper/oracle), which is a contract
// change. Until then this reads REAL public prices (so honest clients report honest
// numbers) and clamps to sane bounds; it never fabricates random gains.

const IDS = ['djed', 'cardano', 'midnight-3', 'snek'] as const; // matches [DJED, ADA, NIGHT, SNEK]
const MAX_BPS = 2000; // reject/clamp absurd single-epoch moves (>20%)

export interface Oracle {
  up: number[];
  down: number[];
}

const clamp = (n: number) => Math.max(0, Math.min(MAX_BPS, Math.round(n)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch 24h returns from CoinGecko and turn them into per-asset up/down bps.
 * Retries a couple of times (CoinGecko's free tier rate-limits with 429), and
 * throws a clear error if the oracle is truly unavailable — so a flat epoch is
 * never silently recorded as "PnL didn't move".
 */
export async function fetchOracle(): Promise<Oracle> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(800 * attempt);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) { lastErr = `CoinGecko HTTP ${res.status}`; continue; }
      const data = (await res.json()) as Record<string, { usd_24h_change?: number }>;
      const up = [0, 0, 0, 0];
      const down = [0, 0, 0, 0];
      let sawAny = false;
      IDS.forEach((id, i) => {
        const changePct = data[id]?.usd_24h_change;
        if (typeof changePct === 'number') sawAny = true;
        const bps = (changePct ?? 0) * 100; // 1% -> 100 bps
        if (bps >= 0) up[i] = clamp(bps);
        else down[i] = clamp(-bps);
      });
      if (!sawAny) { lastErr = 'CoinGecko returned no 24h change data'; continue; }
      return { up, down };
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
    }
  }
  throw new Error(`Price oracle unavailable (${lastErr}). CoinGecko may be rate-limiting — try again in a moment.`);
}

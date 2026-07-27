// Oracle input for an epoch. Asset order is fixed: [USDC, ETH, BTC, ARB].
//
// SECURITY NOTE: the contract accepts upBps/downBps as public parameters and cannot
// itself verify they are truthful — so a modified client could still submit fake
// returns to inflate its public leaderboard PnL. A fully trustless leaderboard needs
// a signed price attestation the circuit checks (a keeper/oracle), which is a contract
// change. Until then this reads REAL public prices (so honest clients report honest
// numbers) and clamps to sane bounds; it never fabricates random gains.

const IDS = ['usd-coin', 'ethereum', 'bitcoin', 'arbitrum'] as const; // matches [USDC, ETH, BTC, ARB]
const MAX_BPS = 2000; // reject/clamp absurd single-epoch moves (>20%)

export interface Oracle {
  up: number[];
  down: number[];
}

const clamp = (n: number) => Math.max(0, Math.min(MAX_BPS, Math.round(n)));

/** Fetch 24h returns from CoinGecko and turn them into per-asset up/down bps. */
export async function fetchOracle(): Promise<Oracle> {
  const flat: Oracle = { up: [0, 0, 0, 0], down: [0, 0, 0, 0] };
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) return flat;
    const data = (await res.json()) as Record<string, { usd_24h_change?: number }>;
    const up = [0, 0, 0, 0];
    const down = [0, 0, 0, 0];
    IDS.forEach((id, i) => {
      const changePct = data[id]?.usd_24h_change ?? 0;
      const bps = changePct * 100; // 1% -> 100 bps
      if (bps >= 0) up[i] = clamp(bps);
      else down[i] = clamp(-bps);
    });
    return { up, down };
  } catch {
    return flat; // no data -> flat epoch, never fabricate
  }
}

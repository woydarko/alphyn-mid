// NIGHT denomination helpers. 1 NIGHT = 1,000,000 STAR (6 decimals); the wallet
// and contract deal in STAR (base units), the UI shows whole tNIGHT.

export const NIGHT_DECIMALS = 6;
const SCALE = 1_000_000; // 10 ** NIGHT_DECIMALS

/** STAR (base units) -> tNIGHT number for display/math. */
export const starToNight = (star: bigint | number): number => Number(star) / SCALE;

/** Format STAR as a tNIGHT string, trimming trailing zeros. */
export const fmtNight = (star: bigint | number, maxFrac = 4): string => {
  const n = starToNight(star);
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
};

/** Parse a tNIGHT input string (may be fractional) into STAR base units. */
export const nightToStar = (input: string): bigint => {
  const s = input.trim();
  if (!s || !/^\d*\.?\d*$/.test(s)) return 0n;
  const [whole, frac = ''] = s.split('.');
  const fracPadded = (frac + '0'.repeat(NIGHT_DECIMALS)).slice(0, NIGHT_DECIMALS);
  return BigInt(whole || '0') * BigInt(SCALE) + BigInt(fracPadded || '0');
};

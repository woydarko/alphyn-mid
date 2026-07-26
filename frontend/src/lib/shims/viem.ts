// Migration shim for 'viem'. Amount helpers are real (used for display); the
// EVM client/ABI helpers are inert stubs (replaced by Midnight indexer reads +
// circuit calls in ALP-12).

export function parseUnits(value: string, decimals: number): bigint {
  const neg = value.startsWith('-');
  const clean = neg ? value.slice(1) : value;
  const [whole, frac = ''] = clean.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const result = BigInt((whole || '0') + fracPadded);
  return neg ? -result : result;
}

export function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const s = v.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals) || '0';
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

export const parseEther = (v: string): bigint => parseUnits(v, 18);
export const formatEther = (v: bigint): string => formatUnits(v, 18);

// ── Inert EVM stubs ──
export function createPublicClient(_cfg?: unknown) {
  return {
    getLogs: async (_args?: unknown) => [] as unknown[],
    readContract: async (_args?: unknown) => undefined,
    getBalance: async (_args?: unknown) => 0n,
  };
}
export function http(_url?: string) {
  return {};
}
export function decodeEventLog(_args?: unknown): { eventName: string; args: Record<string, unknown> } {
  return { eventName: '', args: {} };
}
export function parseAbiItem(_sig?: string): Record<string, unknown> {
  return {};
}

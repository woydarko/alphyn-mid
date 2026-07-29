// Midnight Preview block explorer. The tx-detail base is kept in one place so the
// demo link is easy to correct: override with VITE_EXPLORER_TX_BASE, or set it to
// an empty string to hide the "View on explorer" link entirely.
// Verified live: single tx pages are /transactions/0x<64-hex-hash>.
export const EXPLORER_TX_BASE =
  (import.meta.env.VITE_EXPLORER_TX_BASE as string | undefined) ??
  'https://preview.midnightexplorer.com/transactions/';

export const explorerTxUrl = (txId?: string | null): string | null => {
  if (!txId || !EXPLORER_TX_BASE) return null;
  // The explorer expects a 0x-prefixed hash; bridge/SDK txIds sometimes omit it.
  const hash = txId.startsWith('0x') ? txId : `0x${txId}`;
  return `${EXPLORER_TX_BASE}${hash}`;
};

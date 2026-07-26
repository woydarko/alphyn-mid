'use client';

// Compatibility shim for '@rainbow-me/rainbowkit' during the migration.
// `useConnectModal().openConnectModal` maps to the Lace connect flow.

import { useMidnightWallet } from '@/lib/midnight/wallet';

export function useConnectModal() {
  const w = useMidnightWallet();
  return { openConnectModal: () => void w.connect(), connectModalOpen: w.connecting };
}

'use client';

// On Midnight there is no SIWE / server session - connecting Lace IS the auth.
// This keeps the original useAuth() surface so pages don't need editing.

import { useMidnightWallet } from '@/lib/midnight/wallet';

export function useAuth() {
  const w = useMidnightWallet();
  return {
    isAuthed: w.connected,
    isSignLoading: w.connecting,
    signIn: w.connect,
    logout: w.disconnect,
    address: w.address,
  };
}

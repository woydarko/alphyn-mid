'use client';

// Compatibility shim: pages that still `import { ... } from 'wagmi'` resolve here
// (via next.config + tsconfig alias) during the EVM→Midnight migration.
//
// - Wallet/account hooks are backed by the real Midnight wallet.
// - EVM contract hooks (useReadContract/useWriteContract/…) are inert stubs:
//   the app builds and renders, and each is replaced by a real Midnight circuit
//   call in ALP-12 (wire circuits to UI). They intentionally do nothing yet.

import React from 'react';
import { useMidnightWallet } from '@/lib/midnight/wallet';

export function useAccount() {
  const w = useMidnightWallet();
  return {
    address: w.address as `0x${string}` | undefined,
    isConnected: w.connected,
    isConnecting: w.connecting,
    isDisconnected: !w.connected,
    chainId: undefined as number | undefined,
    status: (w.connected ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
  };
}

export function useDisconnect() {
  const w = useMidnightWallet();
  return { disconnect: w.disconnect, disconnectAsync: async () => w.disconnect() };
}

export function useSignMessage() {
  return {
    signMessageAsync: async (_args?: unknown): Promise<string> => {
      throw new Error('Message signing (SIWE) is not used on Midnight; connection is auth.');
    },
  };
}

// ── Inert EVM-contract stubs (replaced by Midnight circuit calls in ALP-12) ──

export function useReadContract<T = unknown>() {
  return {
    data: undefined as T | undefined,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: async () => ({ data: undefined as T | undefined }),
  };
}

export function useWriteContract() {
  return {
    writeContract: (_args?: unknown) => undefined,
    writeContractAsync: async (_args?: unknown): Promise<`0x${string}` | undefined> => undefined,
    data: undefined as `0x${string}` | undefined,
    isPending: false,
    isError: false,
    error: null as Error | null,
    reset: () => undefined,
  };
}

export function useWaitForTransactionReceipt(_args?: unknown) {
  return { data: undefined, isLoading: false, isSuccess: false, isError: false };
}

export function usePublicClient() {
  return undefined;
}

export function useWatchContractEvent(_args?: unknown) {
  return undefined;
}

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

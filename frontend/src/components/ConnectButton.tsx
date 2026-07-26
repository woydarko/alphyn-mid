'use client';

import React from 'react';
import { useMidnightWallet, shortAddress } from '@/lib/midnight/wallet';

// Lace connect / disconnect - replaces RainbowKit's ConnectButton.
export function ConnectButton() {
  const { connected, connecting, address, connect, disconnect } = useMidnightWallet();

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
          title="Connected"
        />
        <button
          onClick={disconnect}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-alphyn-surface border border-alphyn-surfaceBorder text-alphyn-text hover:border-[#FF5E1A] transition-colors"
          title={address}
        >
          {shortAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="px-4 py-2 rounded-lg text-sm font-bold bg-[#FF5E1A] text-white hover:brightness-110 disabled:opacity-60 transition-all"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

'use client';

import React from 'react';
import { useMidnightWallet, MIDNIGHT_NETWORK } from '@/lib/midnight/wallet';

// On Midnight, the network is chosen inside Lace. If a connection error mentions
// the network, surface a hint to switch Lace to the expected network.
export function WrongNetworkBanner() {
  const { error } = useMidnightWallet();
  if (!error) return null;

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 text-center flex items-center justify-center gap-4 fixed top-0 left-0 right-0 z-[9999] shadow-md">
      <span className="font-medium">
        {error} - make sure your wallet is set to <b>{MIDNIGHT_NETWORK}</b>.
      </span>
    </div>
  );
}

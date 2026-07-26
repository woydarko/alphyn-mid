'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MidnightWalletProvider } from '@/lib/midnight/wallet';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MidnightWalletProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MidnightWalletProvider>
  );
}

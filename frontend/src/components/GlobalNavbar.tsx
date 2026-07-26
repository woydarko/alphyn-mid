'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Users } from 'lucide-react';
import { ConnectButton } from '@/components/ConnectButton';

export function GlobalNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  // The landing page has its own custom fixed marketing navbar.
  if (pathname === '/') return null;

  return (
    <nav className="flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto border-b border-alphyn-surfaceBorder">
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => router.push('/')}
      >
        <img src="/logo/logo-orange.png" alt="Alphyn" className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform" />
        <span className="text-xl font-bold tracking-tighter text-alphyn-text">Alphyn</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/leaderboard')}
          className="text-sm font-bold text-alphyn-textMuted hover:text-[#FF5E1A] transition-colors hidden md:flex items-center gap-2"
        >
          <Users className="w-4 h-4" /> Leaderboard
        </button>

        <ConnectButton />
      </div>
    </nav>
  );
}

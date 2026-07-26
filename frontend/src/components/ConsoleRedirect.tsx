'use client';

import React, { useEffect } from 'react';

// The live, wallet-driven flow runs in the Alphyn Console (Vite + midnight-js).
// These legacy Next screens redirect there instead of showing stale/inert UI.
const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:5173';

export default function ConsoleRedirect({ label = 'This' }: { label?: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = CONSOLE_URL;
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background text-alphyn-text flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-10 shadow-xl">
        <img src="/logo/logo-orange.png" alt="Alphyn" className="w-12 h-12 rounded-xl mx-auto mb-6" />
        <h1 className="text-2xl font-black mb-2">Opening the Alphyn Console</h1>
        <p className="text-alphyn-textMuted font-medium mb-8">
          {label} runs in the Console, where your wallet drives the live zero-knowledge flow on Midnight.
        </p>
        <a
          href={CONSOLE_URL}
          className="inline-flex items-center justify-center px-8 py-4 bg-[#FF5E1A] text-white font-black rounded-2xl hover:bg-[#E0480C] transition-all"
        >
          Open Console
        </a>
        <p className="text-xs text-alphyn-textMuted mt-4">Redirecting automatically...</p>
      </div>
    </div>
  );
}

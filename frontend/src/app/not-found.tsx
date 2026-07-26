'use client';

import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-8 max-w-md">
        <div className="flex flex-col items-center">
          <div className="relative mb-8">
            <img src="/logo/logo-white.png" alt="Alphyn" className="w-20 h-20 rounded-3xl border border-alphyn-surfaceBorder" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-background">!</div>
          </div>
          <p className="text-alphyn-textMuted font-mono text-sm font-bold uppercase tracking-widest">404</p>
          <h1 className="text-4xl font-black tracking-tight">Page not found</h1>
          <p className="text-alphyn-textMuted leading-relaxed">
            This page doesn't exist or was moved. Your vault and strategy are safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-6 py-3 bg-alphyn-surface border border-alphyn-surfaceBorder text-white font-bold rounded-xl hover:bg-alphyn-surfaceHover transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-6 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Home
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/ConnectButton';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Lock, Zap } from 'lucide-react';

export default function ConnectPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isAuthed, isSignLoading } = useAuth();

  useEffect(() => {
    if (isAuthed) router.push('/create');
  }, [isAuthed, router]);

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
            <img src="/logo/logo-white.png" alt="Alphyn" className="w-16 h-16 rounded-2xl mb-6 shadow-xl shadow-white/5 mx-auto" />
          <h1 className="text-4xl font-black tracking-tighter">Alphyn</h1>
          <p className="text-alphyn-textMuted text-sm font-medium">
            Connect your wallet to access the protocol
          </p>
        </div>

        {/* Card */}
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-6">
          <div className="space-y-4">
            {[
              { icon: <Lock className="w-4 h-4 text-green-400" />, text: 'Sign-in with Ethereum, no password' },
              { icon: <Zap className="w-4 h-4 text-blue-400" />,  text: 'Wallet-native session, no email required' },
              { icon: <ShieldCheck className="w-4 h-4 text-orange-400" />, text: 'Non-custodial, your keys stay yours' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-alphyn-textMuted">
                {item.icon}
                {item.text}
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <ConnectButton />
          </div>

          {isConnected && !isAuthed && !isSignLoading && (
            <p className="text-center text-xs text-alphyn-textMuted">
              Sign the message in your wallet to continue
            </p>
          )}
        </div>

        <p className="text-center text-xs text-alphyn-textMuted">
          Testnet only · Midnight Preview · Non-production demo
        </p>
      </div>
    </div>
  );
}

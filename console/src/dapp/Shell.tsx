import React from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useDapp } from './DappContext';
import { NETWORK_ID } from '../providers';
import Nav from './Nav';

export default function Shell() {
  const { phase, error, connect, wrongNetwork, bridgeMode } = useDapp();

  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-background text-alphyn-text flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-alphyn-orange" />
        <p className="text-alphyn-textMuted font-medium">Connecting your wallet…</p>
      </div>
    );
  }

  if (phase === 'need-wallet') {
    return (
      <div className="min-h-screen bg-background text-alphyn-text flex items-center justify-center px-6">
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-10 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-alphyn-orange grid place-items-center text-white font-black text-2xl mx-auto">A</div>
          <h1 className="text-2xl font-black tracking-tight">Connect your wallet to start</h1>
          <p className="text-alphyn-textMuted text-sm">
            Install a Midnight wallet (1AM or Lace), switch it to Preview, then connect.
          </p>
          {error && <p className="text-sm text-red-600 break-words">{error}</p>}
          <button
            onClick={connect}
            className="w-full py-3.5 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep transition-all"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans">
      {bridgeMode && (
        <div className="bg-green-500/10 border-b border-green-500/20 text-green-700 text-xs font-bold px-6 py-2 text-center">
          Local executor active: transactions run through your operator wallet on this machine.
        </div>
      )}
      {wrongNetwork && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-600 text-sm font-bold px-6 py-2.5 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Wrong network. Switch your wallet to {NETWORK_ID} to transact safely.
        </div>
      )}
      <Nav />
      <Outlet />
    </div>
  );
}

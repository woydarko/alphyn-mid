import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Plus, LogOut, Wallet } from 'lucide-react';
import { useDapp } from './DappContext';

const shortAddr = (a: string) => (a && a.length > 14 ? `${a.slice(0, 10)}…${a.slice(-5)}` : a);

export default function Nav() {
  const nav = useNavigate();
  const loc = useLocation();
  const { address, disconnect } = useDapp();
  const onLeaderboard = loc.pathname.startsWith('/leaderboard');
  return (
    <nav className="flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto border-b border-alphyn-surfaceBorder">
      <button onClick={() => nav('/dashboard')} className="flex items-center gap-2 group">
        <span className="w-8 h-8 rounded-lg bg-alphyn-orange grid place-items-center text-white font-black">A</span>
        <span className="text-xl font-black tracking-tighter text-alphyn-text">Alphyn</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav('/leaderboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            onLeaderboard ? 'bg-alphyn-surfaceHover text-alphyn-text' : 'text-alphyn-textMuted hover:text-alphyn-text'
          }`}
        >
          <Trophy className="w-4 h-4" /> Leaderboard
        </button>
        <button
          onClick={() => nav('/create')}
          className="flex items-center gap-2 px-5 py-2.5 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all"
        >
          <Plus className="w-4 h-4" /> New Strategy
        </button>
        {address && (
          <div className="flex items-center rounded-xl border border-alphyn-surfaceBorder overflow-hidden">
            <span
              className="flex items-center gap-2 pl-3 pr-2.5 py-2 text-xs font-mono font-semibold text-alphyn-textMuted"
              title={address}
            >
              <Wallet className="w-3.5 h-3.5 text-alphyn-orange" /> {shortAddr(address)}
            </span>
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-alphyn-textMuted border-l border-alphyn-surfaceBorder hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Disconnect wallet"
            >
              <LogOut className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

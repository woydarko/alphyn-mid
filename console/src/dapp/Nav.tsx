import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Plus } from 'lucide-react';

export default function Nav() {
  const nav = useNavigate();
  const loc = useLocation();
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
      </div>
    </nav>
  );
}

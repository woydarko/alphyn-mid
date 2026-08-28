import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight, Loader2, X } from 'lucide-react';
import { useDapp } from '../dapp/DappContext';
import { CATEGORY_STYLES } from '../dapp/metrics';
import type { LeaderboardRow } from '../alphyn-api';

const CAT = ['conservative', 'balanced', 'aggressive'];
type Sort = 'pnl' | 'epochs' | 'followers';

export default function Leaderboard() {
  const nav = useNavigate();
  const { leaderboard, refreshLeaderboard, vaults, follow } = useDapp();
  const [sort, setSort] = useState<Sort>('pnl');
  const [target, setTarget] = useState<LeaderboardRow | null>(null);
  const [pct, setPct] = useState(50);
  const [followerId, setFollowerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { refreshLeaderboard(); }, [refreshLeaderboard]);

  const mine = new Set(vaults.map((v) => v.vaultId));
  const myVaults = vaults.filter((v) => v.active && !v.locked);
  const canFollow = myVaults.length > 0;
  const openFollow = (r: LeaderboardRow) => { setTarget(r); setFollowerId(myVaults[0]?.vaultId ?? ''); setErr(null); };

  const pnlPct = (r: LeaderboardRow) => Number(r.netPnlScaled) / 10000;

  const rows = useMemo(() => {
    const sorted = [...leaderboard].filter((r) => r.active);
    sorted.sort((a, b) => {
      if (sort === 'epochs') return Number(b.epochCount - a.epochCount);
      if (sort === 'followers') return Number(b.followers - a.followers);
      return pnlPct(b) - pnlPct(a);
    });
    return sorted;
  }, [leaderboard, sort]);

  const doFollow = async () => {
    if (!target || !followerId) return;
    setBusy(true); setErr(null);
    try {
      await follow(followerId, target.id, pct);
      setTarget(null);
    } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black flex items-center gap-3"><Trophy className="text-yellow-500 w-10 h-10" /> Hall of Alphyns</h1>
          <p className="text-alphyn-textMuted font-medium">Private-strategy vaults, ranked by public track record. Follow direction without seeing the recipe.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['pnl', 'epochs', 'followers'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${sort === s ? 'bg-alphyn-orange text-white border-alphyn-orange' : 'bg-alphyn-surface text-alphyn-textMuted border-alphyn-surfaceBorder hover:border-alphyn-orange/40'}`}>
              {s === 'pnl' ? 'PnL %' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-alphyn-surfaceBorder text-alphyn-textMuted text-[10px] uppercase font-bold tracking-widest">
              <th className="px-6 py-4 w-12 text-center">#</th>
              <th className="px-6 py-4">Vault</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">PnL</th>
              <th className="px-6 py-4 hidden md:table-cell">Epochs</th>
              <th className="px-6 py-4 w-32">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-alphyn-surfaceBorder">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-alphyn-textMuted">No vaults on the ledger yet. Mint one to appear here.</td></tr>
            ) : rows.map((r, i) => {
              const isMine = mine.has(r.id);
              const pnl = pnlPct(r);
              return (
                <tr key={r.id} className="hover:bg-alphyn-surfaceHover/40 transition-colors group">
                  <td className="px-6 py-6 text-center"><span className={`text-sm font-mono font-bold ${i < 3 ? 'text-yellow-500' : 'text-alphyn-textMuted'}`}>{String(i + 1).padStart(2, '0')}</span></td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold group-hover:text-alphyn-orange transition-colors">{r.id.slice(0, 10)}…</span>
                      {isMine && <span className="text-[10px] bg-blue-500/20 text-blue-600 px-1.5 rounded font-bold">YOU</span>}
                    </div>
                  </td>
                  <td className="px-6 py-6"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${CATEGORY_STYLES[CAT[r.category]] ?? ''}`}>{CAT[r.category] ?? r.category}</span></td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                      <span className="flex items-center gap-1 text-[10px] text-alphyn-textMuted font-bold uppercase"><Users className="w-3 h-3" /> {String(r.followers)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 hidden md:table-cell font-mono text-sm text-alphyn-textMuted">{String(r.epochCount)}</td>
                  <td className="px-6 py-6">
                    {isMine ? (
                      <button onClick={() => nav(`/vault/${r.id}`)} className="p-2 rounded-full bg-alphyn-orange text-white hover:bg-alphyn-orangeDeep transition-all"><ArrowRight className="w-4 h-4" /></button>
                    ) : (
                      <button disabled={!canFollow} onClick={() => openFollow(r)} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-alphyn-surface border border-alphyn-surfaceBorder hover:border-alphyn-orange transition-all disabled:opacity-30 disabled:cursor-not-allowed">Follow</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setTarget(null)}>
          <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 max-w-md w-full space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Follow Strategy</h2>
              <button onClick={() => setTarget(null)}><X className="w-5 h-5 text-alphyn-textMuted" /></button>
            </div>
            <p className="text-sm text-alphyn-textMuted">Record a public follow of <span className="font-mono">{target.id.slice(0, 10)}…</span> from your vault. Neither strategy is revealed.</p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-alphyn-textMuted">Follow from</label>
              <select value={followerId} onChange={(e) => setFollowerId(e.target.value)} className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl font-medium focus:outline-none focus:border-alphyn-orange">
                {myVaults.map((v) => <option key={v.vaultId} value={v.vaultId}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-alphyn-textMuted">Allocation to mirror</span><span className="font-mono font-bold text-alphyn-orange">{pct}%</span></div>
              <input type="range" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full" style={{ accentColor: '#8B5CF6' }} />
            </div>
            {err && <p className="text-sm text-red-600 break-words">{err}</p>}
            <button onClick={doFollow} disabled={busy} className="w-full py-3.5 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep disabled:opacity-60 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {busy ? 'Following…' : `Follow @ ${pct}%`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

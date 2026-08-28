import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, MoreVertical, History, Settings as SettingsIcon,
  TrendingUp, TrendingDown, Clock, ShieldCheck, Lock, Play, Loader2, Eye,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useDapp } from '../dapp/DappContext';
import { netPnlBps, navTNight, pnlTNight, pnlSeries, CATEGORY_STYLES } from '../dapp/metrics';

const ASSETS = ['DJED', 'ADA', 'NIGHT', 'SNEK'];

export default function VaultDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { vaultById, runEpoch, closeVault } = useDapp();
  const v = vaultById(id!);
  const [showMenu, setShowMenu] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Auto-run: fire one epoch per strategy epoch-duration while the page is open.
  // The keeper cannot do this server-side without holding the private allocation,
  // so the epoch loop lives with the only party who has the witness: this client.
  useEffect(() => {
    if (!auto || !v || v.principal <= 0) return;
    const ms = Math.max(60, v.epochDurationSeconds) * 1000;
    const t = setInterval(async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      try {
        await runEpoch(v.vaultId);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setAuto(false); // stop the loop instead of hammering a failing node
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    }, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, v?.vaultId, v?.epochDurationSeconds]);

  if (!v) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-alphyn-textMuted">Vault not found.</p>
        <button onClick={() => nav('/dashboard')} className="mt-4 px-6 py-2.5 bg-alphyn-orange text-white font-bold rounded-xl">Back to dashboard</button>
      </div>
    );
  }

  const pnlPct = netPnlBps(v) / 100;
  const isPos = pnlPct >= 0;
  const series = pnlSeries(v).map((p) => ({ epoch: `#${p.n}`, pnl: p.cumBps / 100 }));

  const onRun = async () => {
    setRunning(true); setErr(null);
    try { await runEpoch(v.vaultId); } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setRunning(false); }
  };
  const onClose = async () => {
    setClosing(true); setErr(null);
    try { await closeVault(v.vaultId); nav('/dashboard'); } catch (e: any) { setErr(e?.message ?? String(e)); setClosing(false); setShowClose(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-alphyn-surfaceBorder pb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => nav('/dashboard')} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6 text-alphyn-textMuted" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${CATEGORY_STYLES[v.category]}`}>{v.category}</span>
              <h1 className="text-4xl font-black tracking-tight">{v.name}</h1>
            </div>
            <p className="text-alphyn-textMuted font-mono text-xs truncate max-w-xs">{v.vaultId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={() => nav(`/vault/${v.vaultId}/deposit`)} className="flex-1 md:flex-none px-6 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all flex items-center justify-center gap-2">
            Deposit <ArrowUpRight className="w-5 h-5" />
          </button>
          <button onClick={() => nav(`/vault/${v.vaultId}/deposit?tab=withdraw`)} className="flex-1 md:flex-none px-6 py-3 bg-alphyn-surface border border-alphyn-surfaceBorder font-bold rounded-xl hover:bg-alphyn-surfaceHover transition-all flex items-center justify-center gap-2">
            Withdraw <ArrowDownRight className="w-5 h-5 text-alphyn-textMuted" />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-3 bg-alphyn-surface border border-alphyn-surfaceBorder rounded-xl hover:bg-alphyn-surfaceHover transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                  <button onClick={() => { setShowMenu(false); nav(`/vault/${v.vaultId}/epochs`); }} className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-alphyn-surfaceHover flex items-center gap-3">
                    <History className="w-4 h-4 text-alphyn-textMuted" /> Epoch History
                  </button>
                  <button onClick={() => { setShowMenu(false); nav('/settings'); }} className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-alphyn-surfaceHover flex items-center gap-3">
                    <SettingsIcon className="w-4 h-4 text-alphyn-textMuted" /> Settings
                  </button>
                  <button onClick={() => { setShowMenu(false); setShowClose(true); setConfirmText(''); }} className="w-full px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-3">
                    <Lock className="w-4 h-4 text-red-500" /> Close Vault
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-medium rounded-xl px-4 py-3">{err}</div>}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-6 rounded-3xl">
          <p className="text-alphyn-textMuted text-sm font-semibold mb-1">Custody NAV</p>
          <div className="text-3xl font-black font-mono">{navTNight(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-lg">tNIGHT</span></div>
          <div className="mt-4 px-2.5 py-1 bg-alphyn-orange/10 border border-alphyn-orange/20 rounded-lg inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-alphyn-orange" />
            <span className="text-[10px] font-bold text-alphyn-orange uppercase tracking-widest">Real custody</span>
          </div>
          <p className="text-[10px] text-alphyn-textMuted mt-2">Custody {v.principal.toLocaleString()} tNIGHT · held on-chain.</p>
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-6 rounded-3xl">
          <p className="text-alphyn-textMuted text-sm font-semibold mb-1">Cumulative PnL</p>
          <div className={`text-3xl font-black font-mono flex items-center gap-2 ${isPos ? 'text-green-600' : 'text-red-600'}`}>
            {isPos ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
          <div className="mt-5 text-[10px] font-bold text-alphyn-textMuted uppercase tracking-widest">
            {pnlTNight(v) >= 0 ? '+' : ''}{pnlTNight(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} tNIGHT since inception
          </div>
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-6 rounded-3xl">
          <p className="text-alphyn-textMuted text-sm font-semibold mb-1">Epochs run</p>
          <div className="text-3xl font-black font-mono flex items-center gap-2"><Clock className="w-6 h-6 text-alphyn-orange" />{v.epochs.length}</div>
          {v.principal <= 0 ? (
            <>
              <button onClick={() => nav(`/vault/${v.vaultId}/deposit`)} className="mt-4 w-full py-2.5 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all flex items-center justify-center gap-2">
                Fund to start
              </button>
              <p className="mt-3 text-xs text-alphyn-textMuted">Deposit tNIGHT to activate epochs.</p>
            </>
          ) : (
            v.managed ? (
              <p className="mt-4 text-xs text-green-700 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Keeper is running epochs automatically
              </p>
            ) : (
              <>
                <button onClick={onRun} disabled={running} className="mt-4 w-full py-2.5 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {running ? 'Proving…' : 'Run epoch'}
                </button>
                <label className="mt-3 flex items-center gap-2 text-xs text-alphyn-textMuted font-medium cursor-pointer select-none">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ accentColor: '#FF5E1A' }} />
                  Auto-run every {v.epochDurationSeconds >= 3600 ? `${Math.round(v.epochDurationSeconds / 3600)}h` : `${Math.max(1, Math.round(v.epochDurationSeconds / 60))}m`} while this page is open
                </label>
              </>
            )
          )}
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-6 rounded-3xl">
          <p className="text-alphyn-textMuted text-sm font-semibold mb-1">Strategy integrity</p>
          <span className="px-3 py-1.5 bg-background text-alphyn-text text-[10px] font-bold tracking-widest rounded-lg inline-flex items-center gap-1.5 border border-alphyn-surfaceBorder">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> PROVEN IN ZK
          </span>
          <p className="text-[10px] text-alphyn-textMuted mt-3">Each rebalance proves PnL followed your committed allocation, without revealing it.</p>
        </div>
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-alphyn-surface border border-alphyn-surfaceBorder p-8 rounded-[2rem]">
          <h3 className="text-xl font-bold mb-6">Performance History <span className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-widest">(cumulative %)</span></h3>
          {series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-alphyn-textMuted text-sm">{v.principal <= 0 ? 'Fund the vault to start earning.' : 'The keeper will post the first epoch shortly.'}</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAE5DF" />
                  <XAxis dataKey="epoch" tick={{ fill: '#8A7D74', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8A7D74', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE5DF', fontSize: 13 }} />
                  <Line type="monotone" dataKey="pnl" stroke="#FF5E1A" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-8 rounded-[2rem]">
          <h3 className="text-xl font-bold mb-2">Allocation</h3>
          <p className="text-[11px] text-alphyn-textMuted mb-6">Private to you. Only a commitment is on-chain.</p>
          <div className="space-y-4">
            {ASSETS.map((a, i) => (
              <div key={a} className="flex items-center gap-3">
                <span className="font-mono text-sm w-12 font-semibold">{a}</span>
                <span className="flex-1 h-2.5 bg-alphyn-surfaceHover rounded-full overflow-hidden">
                  <span className="block h-full bg-alphyn-orange rounded-full" style={{ width: `${v.allocation[i]}%` }} />
                </span>
                <span className="font-mono text-sm w-10 text-right">{v.allocation[i]}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showClose && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setShowClose(false)}>
          <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 max-w-md w-full space-y-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-red-600">Close vault</h2>
            <p className="text-sm text-alphyn-textMuted">This marks the vault inactive on-chain and cannot be undone. Type <span className="font-bold text-red-600">CONFIRM</span> to proceed.</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM"
              className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl font-mono focus:outline-none focus:border-red-500" />
            {err && <p className="text-sm text-red-600 break-words">{err}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="flex-1 py-3 border border-alphyn-surfaceBorder font-bold rounded-xl hover:bg-alphyn-surfaceHover">Cancel</button>
              <button onClick={onClose} disabled={confirmText !== 'CONFIRM' || closing} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-40 transition-all">
                {closing ? 'Closing…' : 'Close vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

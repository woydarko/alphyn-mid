import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, MoreVertical, History, Settings as SettingsIcon,
  TrendingUp, TrendingDown, Clock, ShieldCheck, Lock, Loader2, Eye,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useDapp } from '../dapp/DappContext';
import { netPnlBps, navTNight, pnlTNight, pnlSeries, CATEGORY_STYLES } from '../dapp/metrics';
import { fmtNight } from '../dapp/night';

const ASSETS = ['DJED', 'ADA', 'NIGHT', 'SNEK'];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const pos = val >= 0;
  return (
    <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-xl px-3 py-2 shadow-2xl">
      <div className="text-[10px] font-bold uppercase tracking-widest text-alphyn-textMuted">{label}</div>
      <div className={`font-mono font-bold text-sm ${pos ? 'text-green-400' : 'text-red-400'}`}>{pos ? '+' : ''}{val.toFixed(2)}%</div>
    </div>
  );
}

export default function VaultDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { vaultById, closeVault, vaultCustody } = useDapp();
  const [chainCustody, setChainCustody] = useState<bigint | null>(null);
  const v = vaultById(id!);
  const [showMenu, setShowMenu] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Read the vault's real custody from chain, so the per-asset breakdown shows
  // provable tNIGHT amounts (custody x weight), not just percentages.
  useEffect(() => {
    if (!v) return;
    vaultCustody(v.vaultId).then(setChainCustody).catch(() => setChainCustody(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.vaultId, v?.epochs.length]);

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

      {err && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl px-4 py-3">{err}</div>}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-5 rounded-2xl flex flex-col min-h-[140px]">
          <p className="text-[11px] font-bold text-alphyn-textMuted uppercase tracking-widest mb-3">Custody NAV</p>
          <div className="text-3xl font-black font-mono leading-none">
            {fmtNight(navTNight(v))} <span className="text-base text-alphyn-textMuted">tNIGHT</span>
          </div>
          <p className="text-[11px] text-alphyn-textMuted mt-auto pt-4">Real custody · held on-chain</p>
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-5 rounded-2xl flex flex-col min-h-[140px]">
          <p className="text-[11px] font-bold text-alphyn-textMuted uppercase tracking-widest mb-3">Cumulative PnL</p>
          <div className={`text-3xl font-black font-mono leading-none flex items-center gap-2 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
            {isPos ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
          <p className="text-[11px] text-alphyn-textMuted mt-auto pt-4">
            {pnlTNight(v) >= 0 ? '+' : ''}{fmtNight(pnlTNight(v))} tNIGHT since inception
          </p>
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-5 rounded-2xl flex flex-col min-h-[140px]">
          <p className="text-[11px] font-bold text-alphyn-textMuted uppercase tracking-widest mb-3">Epochs run</p>
          <div className="text-3xl font-black font-mono leading-none flex items-center gap-2">
            <Clock className="w-6 h-6 text-alphyn-orange" />{v.epochs.length}
          </div>
          <p className="text-[11px] text-alphyn-textMuted mt-auto pt-4">
            {v.managed ? 'Keeper runs epochs automatically' : 'Advances one per deposit'}
          </p>
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-5 rounded-2xl flex flex-col min-h-[140px]">
          <p className="text-[11px] font-bold text-alphyn-textMuted uppercase tracking-widest mb-3">Strategy integrity</p>
          <div className="text-2xl font-black leading-none flex items-center gap-2 text-green-400">
            <ShieldCheck className="w-6 h-6" /> Proven
          </div>
          <p className="text-[11px] text-alphyn-textMuted mt-auto pt-4">Every rebalance ZK-proven, weights hidden</p>
        </div>
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-alphyn-surface border border-alphyn-surfaceBorder p-8 rounded-2xl">
          <h3 className="text-xl font-bold mb-6">Performance History <span className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-widest">(cumulative %)</span></h3>
          {series.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-alphyn-textMuted text-sm">Deposit tNIGHT — each deposit posts a PnL point.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#2C2348" strokeDasharray="4 4" />
                  <XAxis dataKey="epoch" tick={{ fill: '#9D92BC', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9D92BC', fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(x) => `${x}%`} />
                  <ReferenceLine y={0} stroke="#3A2E5C" strokeWidth={1} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="pnl" stroke="#8B5CF6" strokeWidth={2} fill="url(#pnlFill)"
                    dot={false} activeDot={{ r: 5, fill: '#8B5CF6', stroke: '#0E0A1A', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xl font-bold">Allocation</h3>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/25 rounded-lg px-2 py-1 uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" /> On-chain
            </span>
          </div>
          <p className="text-[11px] text-alphyn-textMuted mb-6 leading-relaxed">
            <span className="font-mono text-alphyn-text">{chainCustody === null ? '…' : fmtNight(chainCustody)}</span> tNIGHT
            custody is real and proven on-chain. The per-asset split is your <b>target allocation</b> (weights private) —
            the vault holds tNIGHT and prices it against the basket; on-chain swaps into DJED/ADA/SNEK are not live yet.
          </p>
          <div className="space-y-4">
            {ASSETS.map((a, i) => {
              const amt = chainCustody === null ? null : (chainCustody * BigInt(v.allocation[i])) / 100n;
              return (
                <div key={a} className="flex items-center gap-3">
                  <span className="font-mono text-sm w-12 font-semibold">{a}</span>
                  <span className="flex-1 h-2.5 bg-alphyn-surfaceHover rounded-full overflow-hidden">
                    <span className="block h-full bg-gradient-to-r from-alphyn-orange to-[#A78BFA] rounded-full transition-all duration-500" style={{ width: `${v.allocation[i]}%` }} />
                  </span>
                  <span className="font-mono text-xs w-28 text-right">
                    <span className="text-alphyn-text font-bold">{v.allocation[i]}%</span>
                    {amt !== null && <span className="text-alphyn-textMuted"> · {fmtNight(amt)} tN</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showClose && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setShowClose(false)}>
          <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl p-8 max-w-md w-full space-y-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-red-400">Close vault</h2>
            <p className="text-sm text-alphyn-textMuted">This marks the vault inactive on-chain and cannot be undone. Type <span className="font-bold text-red-400">CONFIRM</span> to proceed.</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM"
              className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl font-mono focus:outline-none focus:border-red-500" />
            {err && <p className="text-sm text-red-400 break-words">{err}</p>}
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

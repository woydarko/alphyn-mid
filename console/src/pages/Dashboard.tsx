import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, BarChart3, Clock, Wallet, ArrowRight } from 'lucide-react';
import { useDapp, type LocalVault } from '../dapp/DappContext';
import { netPnlBps, CATEGORY_STYLES } from '../dapp/metrics';
import { fmtNight } from '../dapp/night';

function VaultCard({ v, onClick }: { v: LocalVault; onClick: () => void }) {
  const pnl = netPnlBps(v) / 100;
  const isPos = pnl >= 0;
  const assets = v.allocation.filter((w) => w > 0).length;
  return (
    <div
      onClick={onClick}
      className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl p-5 cursor-pointer hover:border-alphyn-orange/60 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 group space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-base leading-tight truncate group-hover:text-alphyn-orange transition-colors">{v.name}</h3>
          <span className={`inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${CATEGORY_STYLES[v.category]}`}>
            {v.category}
          </span>
        </div>
        <div className={`text-lg font-black font-mono flex items-center gap-1 shrink-0 ${isPos ? 'text-green-400' : 'text-red-400'}`}>
          {isPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPos ? '+' : ''}{pnl.toFixed(2)}%
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-wider">Custody</p>
          <p className="text-xl font-black font-mono">{fmtNight(v.principal)} <span className="text-xs font-bold text-alphyn-textMuted">tNIGHT</span></p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-wider">Epochs</p>
            <p className="text-sm font-bold font-mono">{v.epochs.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-wider">Assets</p>
            <p className="text-sm font-bold font-mono">{assets}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end pt-3 border-t border-alphyn-surfaceBorder">
        <span className="text-xs font-bold text-alphyn-textMuted group-hover:text-alphyn-orange transition-all flex items-center gap-1 group-hover:gap-2">
          Open <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-alphyn-surfaceHover flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-[11px] font-bold text-alphyn-textMuted uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black">{value}</p>
        {sub && <p className="text-[10px] text-alphyn-textMuted font-medium">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const { vaults } = useDapp();

  const avgPnl = vaults.length ? vaults.reduce((s, v) => s + netPnlBps(v), 0) / vaults.length / 100 : 0;
  const bestPnl = vaults.length ? Math.max(...vaults.map((v) => netPnlBps(v))) / 100 : 0;
  const totalCustody = vaults.reduce((s, v) => s + (v.principal || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">My Vaults</h1>
          <p className="text-alphyn-textMuted text-sm mt-1">
            {vaults.length} {vaults.length === 1 ? 'vault' : 'vaults'} · private, proven in ZK
          </p>
        </div>
        <button
          onClick={() => nav('/create')}
          className="flex items-center gap-2 px-6 py-3 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> New Strategy
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Vaults" value={String(vaults.length)} sub="on-chain" icon={<Wallet className="w-5 h-5 text-alphyn-textMuted" />} />
        <Stat label="Total Custody" value={fmtNight(totalCustody)} sub="tNIGHT held on-chain" icon={<Clock className="w-5 h-5 text-alphyn-orange" />} />
        <Stat label="Avg PnL" value={`${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}%`} sub="across all vaults" icon={<BarChart3 className={`w-5 h-5 ${avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`} />} />
        <Stat label="Best Vault" value={`${bestPnl >= 0 ? '+' : ''}${bestPnl.toFixed(2)}%`} sub="cumulative PnL" icon={<TrendingUp className={`w-5 h-5 ${bestPnl >= 0 ? 'text-green-400' : 'text-red-400'}`} />} />
      </div>

      {vaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-5">
          <div className="w-14 h-14 rounded-2xl bg-alphyn-surface border border-alphyn-surfaceBorder flex items-center justify-center">
            <Wallet className="w-7 h-7 text-alphyn-textMuted" />
          </div>
          <p className="font-bold text-lg">No vaults yet</p>
          <button onClick={() => nav('/create')} className="flex items-center gap-2 px-7 py-3.5 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4" /> Create your first vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vaults.map((v) => (
            <VaultCard key={v.vaultId} v={v} onClick={() => nav(`/vault/${v.vaultId}`)} />
          ))}
          <div
            onClick={() => nav('/create')}
            className="border border-dashed border-alphyn-surfaceBorder rounded-2xl p-5 cursor-pointer hover:border-alphyn-orange/60 hover:-translate-y-0.5 transition-all flex flex-col items-center justify-center gap-3 min-h-[180px] group"
          >
            <div className="w-11 h-11 rounded-xl bg-alphyn-surface border border-alphyn-surfaceBorder flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors" />
            </div>
            <p className="font-bold text-sm text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors">New vault</p>
          </div>
        </div>
      )}
    </div>
  );
}

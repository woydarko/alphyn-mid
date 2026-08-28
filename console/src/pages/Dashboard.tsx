import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Plus, BarChart3, Clock, Wallet, ArrowRight } from 'lucide-react';
import { useDapp, type LocalVault } from '../dapp/DappContext';
import { netPnlBps, maxDrawdownBps, CATEGORY_STYLES } from '../dapp/metrics';

function VaultCard({ v, onClick }: { v: LocalVault; onClick: () => void }) {
  const pnl = netPnlBps(v) / 100;
  const isPos = pnl >= 0;
  const assets = v.allocation.filter((w) => w > 0).length;
  return (
    <div
      onClick={onClick}
      className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-6 cursor-pointer hover:border-alphyn-orange/50 transition-all group space-y-5"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${CATEGORY_STYLES[v.category]}`}>
            {v.category}
          </span>
          <h3 className="font-bold text-lg leading-tight group-hover:text-alphyn-orange transition-colors">{v.name}</h3>
        </div>
        <div className={`text-xl font-black font-mono flex items-center gap-1 ${isPos ? 'text-green-600' : 'text-red-600'}`}>
          {isPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPos ? '+' : ''}{pnl.toFixed(2)}%
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Epochs', String(v.epochs.length)],
          ['Assets', String(assets)],
          ['Max DD', `${(maxDrawdownBps(v) / 100).toFixed(1)}%`],
        ].map(([l, val]) => (
          <div key={l} className="bg-alphyn-surfaceHover rounded-xl p-3 text-center">
            <p className="text-[10px] font-bold text-alphyn-textMuted uppercase tracking-wider mb-1">{l}</p>
            <p className="text-sm font-bold">{val}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-alphyn-surfaceBorder">
        <span className="text-[10px] font-mono text-alphyn-textMuted truncate max-w-[160px]">{v.vaultId.slice(0, 18)}…</span>
        <span className="text-xs font-bold text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors flex items-center gap-1">
          Open <ArrowRight className="w-3 h-3" />
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
  const totalEpochs = vaults.reduce((s, v) => s + v.epochs.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">My Vaults</h1>
          <p className="text-alphyn-textMuted text-sm mt-1">
            {vaults.length} active {vaults.length === 1 ? 'strategy' : 'strategies'} · allocations private, proven in zero knowledge
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
        <Stat label="Avg PnL" value={`${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}%`} sub="across all vaults" icon={<BarChart3 className={`w-5 h-5 ${avgPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} />} />
        <Stat label="Best Vault" value={`${bestPnl >= 0 ? '+' : ''}${bestPnl.toFixed(2)}%`} sub="cumulative PnL" icon={<TrendingUp className={`w-5 h-5 ${bestPnl >= 0 ? 'text-green-600' : 'text-red-600'}`} />} />
        <Stat label="Total Epochs" value={String(totalEpochs)} sub="executed" icon={<Clock className="w-5 h-5 text-alphyn-textMuted" />} />
      </div>

      {vaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-alphyn-surface border border-alphyn-surfaceBorder flex items-center justify-center">
            <Wallet className="w-8 h-8 text-alphyn-textMuted" />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">No vaults yet</p>
            <p className="text-alphyn-textMuted text-sm mt-1">Answer a few questions to generate your first strategy</p>
          </div>
          <button onClick={() => nav('/create')} className="flex items-center gap-2 px-8 py-4 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep transition-all">
            <Plus className="w-4 h-4" /> Create Your First Vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vaults.map((v) => (
            <VaultCard key={v.vaultId} v={v} onClick={() => nav(`/vault/${v.vaultId}`)} />
          ))}
          <div
            onClick={() => nav('/create')}
            className="border border-dashed border-alphyn-surfaceBorder rounded-3xl p-6 cursor-pointer hover:border-alphyn-orange/50 transition-all flex flex-col items-center justify-center gap-3 min-h-[220px] group"
          >
            <div className="w-12 h-12 rounded-2xl bg-alphyn-surface border border-alphyn-surfaceBorder flex items-center justify-center">
              <Plus className="w-6 h-6 text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors" />
            </div>
            <p className="font-bold text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors">Add New Strategy</p>
          </div>
        </div>
      )}
    </div>
  );
}

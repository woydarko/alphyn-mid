import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { useDapp } from '../dapp/DappContext';

export default function Epochs() {
  const { id } = useParams();
  const nav = useNavigate();
  const { vaultById } = useDapp();
  const v = vaultById(id!);
  if (!v) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-alphyn-textMuted">Vault not found.</div>;

  const rows = [...v.epochs].reverse();
  let cum = v.epochs.reduce((s, e) => s + e.pnlBps, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => nav(`/vault/${v.vaultId}`)} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black">Epoch History</h1>
          <p className="text-alphyn-textMuted text-sm font-mono truncate max-w-xs">{v.vaultId}</p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-alphyn-textMuted border-b border-alphyn-surfaceBorder pb-6">
        <span><span className="text-alphyn-text font-bold">{v.epochs.length}</span> total epochs</span>
        <span>Net <span className={`font-bold font-mono ${cum >= 0 ? 'text-green-400' : 'text-red-400'}`}>{cum >= 0 ? '+' : ''}{(cum / 100).toFixed(2)}%</span></span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-alphyn-textMuted font-bold">No epochs yet. Run one from the vault.</div>
      ) : (
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-alphyn-surfaceBorder text-alphyn-textMuted text-xs uppercase tracking-wider">
                <th className="text-left p-4">Epoch</th>
                <th className="text-left p-4">PnL Delta</th>
                <th className="text-left p-4 hidden md:table-cell">Proof</th>
                <th className="text-left p-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-alphyn-surfaceBorder">
              {rows.map((e) => (
                <tr key={e.n} className="hover:bg-alphyn-surfaceHover/40 transition-colors">
                  <td className="p-4 font-bold font-mono">#{e.n}</td>
                  <td className="p-4">
                    <span className={`flex items-center gap-1 font-bold font-mono ${e.pnlBps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {e.pnlBps >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {e.pnlBps >= 0 ? '+' : ''}{(e.pnlBps / 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-green-400/70 text-xs font-mono"><ShieldCheck className="w-3 h-3" /> ZK verified</span>
                  </td>
                  <td className="p-4 text-alphyn-textMuted text-xs">{new Date(e.ts).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

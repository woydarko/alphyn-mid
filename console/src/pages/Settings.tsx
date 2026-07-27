import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, ShieldCheck } from 'lucide-react';
import { useDapp } from '../dapp/DappContext';

function VaultSettings({ vaultId }: { vaultId: string }) {
  const { vaultById, renameVault, closeVault } = useDapp();
  const v = vaultById(vaultId)!;
  const [name, setName] = useState(v.name);
  const [saved, setSaved] = useState(false);
  const [closing, setClosing] = useState(false);
  const nav = useNavigate();

  const save = () => { renameVault(vaultId, name.trim() || v.name); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const close = async () => {
    if (!confirm('Close this vault? It is marked inactive on-chain.')) return;
    setClosing(true);
    try { await closeVault(vaultId); } finally { setClosing(false); }
  };

  return (
    <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{v.name}</h2>
        <span className="text-[10px] font-mono text-alphyn-textMuted">{v.vaultId.slice(0, 12)}…</span>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-alphyn-textMuted font-medium">Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
          className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl focus:outline-none focus:border-alphyn-orange transition-colors" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="flex items-center gap-2 px-6 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : 'Save'}
        </button>
        <button onClick={() => nav(`/vault/${v.vaultId}`)} className="px-6 py-3 border border-alphyn-surfaceBorder font-bold rounded-xl hover:bg-alphyn-surfaceHover transition-all">Open</button>
      </div>
      {v.active && (
        <div className="border-t border-alphyn-surfaceBorder pt-5">
          <button onClick={close} disabled={closing} className="px-5 py-2.5 border border-red-300 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors text-sm disabled:opacity-50">
            {closing ? 'Closing…' : 'Close vault'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const nav = useNavigate();
  const { vaults, contractAddress } = useDapp();

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => nav('/dashboard')} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-black">Settings</h1>
      </div>

      <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-600" /> Contract</h2>
        <p className="text-xs text-alphyn-textMuted">Your vaults live in this shared Midnight contract on Preview.</p>
        <p className="font-mono text-sm break-all">{contractAddress ?? 'Not deployed yet — mint a vault first.'}</p>
      </div>

      {vaults.length === 0 ? (
        <p className="text-alphyn-textMuted text-sm">No vaults yet.</p>
      ) : (
        vaults.map((v) => <VaultSettings key={v.vaultId} vaultId={v.vaultId} />)
      )}
    </div>
  );
}

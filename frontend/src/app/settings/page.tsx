'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ArrowLeft, Save, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { address } = useAccount();

  const [vaultName, setVaultName] = useState('');
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current vault name from API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { router.push('/connect'); return; }
        const me = await res.json();
        if (!me.vaultId) return;
        setVaultId(me.vaultId);

        const vaultRes = await fetch(`/api/vault/${me.vaultId}`);
        if (vaultRes.ok) {
          const v = await vaultRes.json();
          setVaultName(v.vaultName || '');
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [router]);

  const handleSave = async () => {
    if (!vaultId || !vaultName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vault/${vaultId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: vaultName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans p-6 lg:p-12">
      <div className="max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Vault Settings */}
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-6">
          <h2 className="text-lg font-bold">Vault</h2>

          <div className="space-y-2">
            <label className="text-sm text-alphyn-textMuted font-medium">Vault Display Name</label>
            <input
              type="text"
              value={vaultName}
              onChange={e => setVaultName(e.target.value)}
              maxLength={64}
              placeholder="My Vault"
              className="w-full px-4 py-3 bg-alphyn-surfaceBorder border border-alphyn-surfaceBorder rounded-xl text-alphyn-text placeholder:text-alphyn-textMuted focus:outline-none focus:border-white transition-colors"
            />
            <p className="text-xs text-alphyn-textMuted">{vaultName.length}/64 characters</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !vaultName.trim() || !vaultId}
            className="flex items-center gap-2 px-6 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
             saved  ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                      <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Wallet Info */}
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-4">
          <h2 className="text-lg font-bold">Wallet</h2>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-alphyn-surfaceBorder flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-alphyn-textMuted" />
            </div>
            <div>
              <p className="text-xs text-alphyn-textMuted font-medium uppercase tracking-wider">Connected Address</p>
              <p className="font-mono text-sm text-alphyn-text break-all">{address || '-'}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        {vaultId && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-3xl p-8 space-y-4">
            <h2 className="text-lg font-bold text-red-400">Danger Zone</h2>
            <p className="text-sm text-alphyn-textMuted">Closing your vault marks it inactive in the database. It does not withdraw funds, do that first.</p>
            <button
              onClick={async () => {
                if (!confirm('Close vault? This marks it inactive. Withdraw funds first.')) return;
                await fetch(`/api/vault/${vaultId}/close`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirmation: true }),
                });
                router.push('/');
              }}
              className="px-6 py-2.5 border border-red-800 text-red-400 font-bold rounded-xl hover:bg-red-900/30 transition-colors text-sm"
            >
              Close Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

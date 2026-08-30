import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';
import { useDapp } from '../dapp/DappContext';
import { fmtNight, nightToStar, starToNight } from '../dapp/night';

export default function Deposit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { vaultById, depositReal, withdrawReal, vaultCustody, walletNightBalance } = useDapp();
  const v = vaultById(id!);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>(sp.get('tab') === 'withdraw' ? 'withdraw' : 'deposit');
  const [amt, setAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [custody, setCustody] = useState<bigint | null>(null);
  const [walletBal, setWalletBal] = useState<bigint | null>(null);

  const refreshBalances = useCallback(() => {
    if (!v) return;
    vaultCustody(v.vaultId).then(setCustody).catch(() => setCustody(null));
    walletNightBalance().then(setWalletBal).catch(() => setWalletBal(null));
  }, [v, vaultCustody, walletNightBalance]);

  useEffect(() => { refreshBalances(); }, [refreshBalances]);

  const available = mode === 'deposit' ? walletBal : custody;
  const amtStar = nightToStar(amt);
  const overAvailable = available != null && amtStar > available;
  const setMax = () => { if (available != null) setAmt(String(starToNight(available))); };

  if (!v) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-alphyn-textMuted">Vault not found.</div>;

  const submit = async () => {
    const base = nightToStar(amt);
    if (base <= 0n) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'deposit') await depositReal(v.vaultId, base);
      else await withdrawReal(v.vaultId, base);
      setMsg(`${mode === 'deposit' ? 'Deposit' : 'Withdraw'} submitted on-chain ✓`);
      setAmt('');
      setTimeout(refreshBalances, 4000);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => nav(`/vault/${v.vaultId}`)} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-black">{v.name}</h1>
      </div>

      <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-alphyn-orange" />
            <h2 className="text-lg font-black">On-chain custody</h2>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black font-mono text-alphyn-orange">
              {custody === null ? '…' : fmtNight(custody)} <span className="text-sm">tNIGHT</span>
            </div>
            <div className="text-[10px] text-alphyn-textMuted uppercase tracking-widest">held in vault</div>
          </div>
        </div>

        <p className="text-xs text-alphyn-textMuted leading-relaxed">
          Real tNIGHT moves in and out of the vault&apos;s custody. A <b>deposit also runs one epoch</b> in the
          same transaction — funding the vault advances it, no separate &quot;Run epoch&quot; signature needed.
        </p>

        <div className="flex bg-background border border-alphyn-surfaceBorder rounded-xl p-1">
          {(['deposit', 'withdraw'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold capitalize transition-all flex items-center justify-center gap-2 ${
                mode === m ? 'bg-alphyn-orange text-white' : 'text-alphyn-textMuted'
              }`}
            >
              {m === 'deposit' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />} {m}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-alphyn-textMuted">
            <span>{mode === 'deposit' ? 'Wallet balance' : 'Vault custody'}</span>
            <span className="font-mono">{available === null ? '…' : `${fmtNight(available)} tNIGHT`}</span>
          </div>
          <div className="relative">
            <input
              type="number"
              min={0}
              step="any"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              placeholder="amount in tNIGHT"
              className="w-full px-4 py-3 pr-16 bg-background border border-alphyn-surfaceBorder rounded-xl font-mono text-lg focus:outline-none focus:border-alphyn-orange transition-colors"
            />
            <button
              onClick={setMax}
              disabled={available == null || available <= 0n}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-bold text-alphyn-orange bg-alphyn-orange/10 rounded-lg hover:bg-alphyn-orange/20 disabled:opacity-40 transition-colors"
            >
              MAX
            </button>
          </div>
        </div>

        {overAvailable && (
          <p className="text-xs font-medium text-red-400">
            Amount exceeds your {mode === 'deposit' ? 'wallet balance' : 'vault custody'} ({available === null ? '…' : fmtNight(available)} tNIGHT).
          </p>
        )}
        {msg && <p className="text-xs font-mono break-words text-alphyn-textMuted">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy || !amt || amtStar <= 0n || overAvailable}
          className="w-full py-3.5 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep disabled:opacity-40 transition-all capitalize"
        >
          {busy ? 'Submitting…' : `${mode} tNIGHT`}
        </button>
      </div>
    </div>
  );
}

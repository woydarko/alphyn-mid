import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { useDapp } from '../dapp/DappContext';
import { navUsd } from '../dapp/notional';

export default function Deposit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { vaultById, setPrincipal, depositReal } = useDapp();
  const v = vaultById(id!);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(sp.get('tab') === 'withdraw' ? 'withdraw' : 'deposit');
  const [amount, setAmount] = useState('');
  const [realAmt, setRealAmt] = useState('');
  const [realBusy, setRealBusy] = useState(false);
  const [realMsg, setRealMsg] = useState<string | null>(null);

  const submitReal = async () => {
    const base = (() => { try { return BigInt(realAmt); } catch { return 0n; } })();
    if (base <= 0n) return;
    setRealBusy(true);
    setRealMsg(null);
    try {
      await depositReal(v!.vaultId, base);
      setRealMsg('Deposit submitted on-chain ✓');
      setRealAmt('');
    } catch (e: any) {
      setRealMsg(e?.message ?? String(e));
    } finally {
      setRealBusy(false);
    }
  };

  if (!v) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-alphyn-textMuted">Vault not found.</div>;

  const amt = Math.max(0, Number(amount) || 0);
  const nextPrincipal = tab === 'deposit' ? v.principal + amt : Math.max(0, v.principal - amt);
  const canSubmit = amt > 0 && (tab === 'deposit' || amt <= v.principal);

  const submit = () => {
    setPrincipal(v.vaultId, nextPrincipal);
    nav(`/vault/${v.vaultId}`);
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => nav(`/vault/${v.vaultId}`)} className="p-2 hover:bg-alphyn-surface rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-black">{v.name}</h1>
      </div>

      <div className="bg-alphyn-orange/5 border border-alphyn-orange/20 rounded-2xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-alphyn-orange shrink-0 mt-0.5" />
        <p className="text-xs text-alphyn-textMuted leading-relaxed">
          The <b>notional</b> deposit below sets paper capital used to size PnL (no tokens move). For real on-chain custody,
          use <b>Real deposit</b> further down — it moves actual tNIGHT into the vault. Basket swaps are oracle-priced and
          still in progress (see the Path A plan).
        </p>
      </div>

      <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-6">
        <div className="flex bg-background border border-alphyn-surfaceBorder rounded-xl p-1">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold capitalize transition-all flex items-center justify-center gap-2 ${
                tab === t ? 'bg-alphyn-orange text-white' : 'text-alphyn-textMuted'
              }`}
            >
              {t === 'deposit' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />} {t}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-alphyn-textMuted font-medium">Amount (USD, notional)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl font-mono text-lg focus:outline-none focus:border-alphyn-orange transition-colors"
          />
          <div className="flex justify-between text-xs text-alphyn-textMuted">
            <span>Current principal: ${v.principal.toLocaleString()}</span>
            <span>NAV: ${navUsd(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        <div className="bg-background border border-alphyn-surfaceBorder rounded-xl p-4 text-sm flex justify-between">
          <span className="text-alphyn-textMuted">Principal after</span>
          <span className="font-mono font-bold">${nextPrincipal.toLocaleString()}</span>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-3.5 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep disabled:opacity-40 transition-all capitalize"
        >
          {tab} ${amt.toLocaleString()}
        </button>
      </div>

      {!v.managed && (
        <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 space-y-4">
          <div>
            <h2 className="text-lg font-black">Real deposit (experimental)</h2>
            <p className="text-xs text-alphyn-textMuted leading-relaxed mt-1">
              Moves actual tNIGHT into the vault's on-chain custody via the <code>deposit</code> circuit.
              Amount is in native base units. Your wallet will prompt to approve the transfer.
            </p>
          </div>
          <input
            type="number"
            min={0}
            value={realAmt}
            onChange={(e) => setRealAmt(e.target.value)}
            placeholder="amount in tNIGHT base units"
            className="w-full px-4 py-3 bg-background border border-alphyn-surfaceBorder rounded-xl font-mono text-lg focus:outline-none focus:border-alphyn-orange transition-colors"
          />
          {realMsg && <p className="text-xs font-mono break-words text-alphyn-textMuted">{realMsg}</p>}
          <button
            onClick={submitReal}
            disabled={realBusy || !realAmt}
            className="w-full py-3.5 border border-alphyn-orange text-alphyn-orange font-bold rounded-2xl hover:bg-alphyn-orange/10 disabled:opacity-40 transition-all"
          >
            {realBusy ? 'Submitting…' : 'Deposit real tNIGHT'}
          </button>
        </div>
      )}
    </div>
  );
}

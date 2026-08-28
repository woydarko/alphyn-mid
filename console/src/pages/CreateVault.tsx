import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import Questionnaire from '../Questionnaire';
import { useDapp } from '../dapp/DappContext';
import type { Strategy } from '../strategy';

type Phase = 'quiz' | 'minting' | 'error';

export default function CreateVault() {
  const nav = useNavigate();
  const { mint } = useDapp();
  const [phase, setPhase] = useState<Phase>('quiz');
  const [error, setError] = useState<string | null>(null);
  // Keep the completed strategy so a failed mint can be retried without redoing
  // the whole questionnaire.
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [vaultName, setVaultName] = useState('');

  const doMint = async (s: Strategy, name: string) => {
    setPhase('minting');
    setError(null);
    try {
      const v = await mint(s, name);
      nav(`/vault/${v.vaultId}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('error');
    }
  };

  const onComplete = (s: Strategy, name: string) => {
    setStrategy(s);
    setVaultName(name);
    doMint(s, name);
  };

  if (phase === 'minting') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-alphyn-orange animate-spin mx-auto" />
        <h2 className="text-2xl font-black">Minting your vault…</h2>
        <p className="text-alphyn-textMuted">Committing your strategy on-chain (allocation stays private).</p>
        <p className="text-xs text-alphyn-textMuted">This runs a real zero-knowledge proof, so it takes a moment. Approve any wallet prompts.</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-5">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-2xl font-black">Mint failed</h2>
        <p className="text-alphyn-textMuted text-sm break-words bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 font-mono">
          {error}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => strategy && doMint(strategy, vaultName)}
            className="px-6 py-3 bg-alphyn-orange text-white font-bold rounded-xl hover:bg-alphyn-orangeDeep transition-all"
          >
            Retry mint
          </button>
          <button
            onClick={() => { setPhase('quiz'); setError(null); }}
            className="px-6 py-3 border border-alphyn-surfaceBorder font-bold rounded-xl hover:bg-alphyn-surfaceHover transition-all"
          >
            Edit answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Questionnaire onComplete={onComplete} onCancel={() => nav('/dashboard')} mintLabel="Mint this strategy" />
    </div>
  );
}

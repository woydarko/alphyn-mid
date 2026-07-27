import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import Questionnaire from '../Questionnaire';
import { useDapp } from '../dapp/DappContext';
import type { Strategy } from '../strategy';

export default function CreateVault() {
  const nav = useNavigate();
  const { mint } = useDapp();
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onComplete = async (s: Strategy, vaultName: string) => {
    setMinting(true);
    setError(null);
    setStatus('Committing your strategy on-chain (allocation stays private)…');
    try {
      const v = await mint(s, vaultName);
      nav(`/vault/${v.vaultId}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setMinting(false);
    }
  };

  if (minting) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-4">
        {error ? (
          <>
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-2xl font-black">Mint failed</h2>
            <p className="text-alphyn-textMuted text-sm break-words">{error}</p>
            <button onClick={() => setMinting(false)} className="px-6 py-2.5 bg-alphyn-orange text-white font-bold rounded-xl">
              Back to questionnaire
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-alphyn-orange animate-spin mx-auto" />
            <h2 className="text-2xl font-black">Minting your vault…</h2>
            <p className="text-alphyn-textMuted">{status}</p>
            <p className="text-xs text-alphyn-textMuted">This runs a real zero-knowledge proof, so it takes a moment.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Questionnaire onComplete={onComplete} onCancel={() => nav('/dashboard')} mintLabel="Mint this strategy" />
    </div>
  );
}

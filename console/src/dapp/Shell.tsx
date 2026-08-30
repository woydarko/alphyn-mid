import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { useDapp } from './DappContext';
import { NETWORK_ID } from '../providers';
import { explorerTxUrl } from '../explorer';
import Nav from './Nav';

function Toasts() {
  const { toasts, dismissToast } = useDapp();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-[22rem] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const url = explorerTxUrl(t.txId);
        const ok = t.kind === 'success';
        return (
          <div
            key={t.id}
            className={`bg-alphyn-surface border rounded-2xl shadow-lg p-4 flex gap-3 items-start animate-[slideIn_.2s_ease-out] ${
              ok ? 'border-green-500/30' : 'border-red-500/30'
            }`}
          >
            {ok ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-alphyn-text">{t.title}</p>
              {t.body && <p className="text-xs text-alphyn-textMuted mt-0.5 truncate">{t.body}</p>}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-alphyn-orange hover:text-alphyn-orangeDeep"
                >
                  View on explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="p-1 rounded-lg text-alphyn-textMuted hover:bg-alphyn-surfaceHover shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function Shell() {
  const { phase, wrongNetwork, bridgeMode } = useDapp();

  if (phase === 'connecting') {
    return (
      <div className="min-h-screen bg-background text-alphyn-text flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-alphyn-orange" />
        <p className="text-alphyn-textMuted font-medium">Connecting your wallet…</p>
      </div>
    );
  }

  // Not connected (fresh load, refresh, or after disconnect): the landing page
  // owns the connect flow, so bounce there instead of prompting inside the app.
  if (phase === 'need-wallet') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-alphyn-text font-sans">
      {bridgeMode && (
        <div className="bg-green-500/10 border-b border-green-500/20 text-green-400 text-xs font-bold px-6 py-2 text-center">
          Local executor active: transactions run through your operator wallet on this machine.
        </div>
      )}
      {wrongNetwork && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm font-bold px-6 py-2.5 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Wrong network. Switch your wallet to {NETWORK_ID} to transact safely.
        </div>
      )}
      <Nav />
      <Outlet />
      <Toasts />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Loader2, ChevronRight, ChevronLeft, ShieldCheck, AlertTriangle, LayoutDashboard, Plus, Shield, Scale, Rocket, Sparkles } from 'lucide-react';

type RiskKey = 'conservative' | 'balanced' | 'aggressive';

type StepData = {
  risk: RiskKey | null;
  horizon: 'short' | 'mid' | 'long' | null;
  assets: Array<'ETH' | 'USDC' | 'ARB' | 'WBTC'>;
  targetApy: 'low' | 'mid' | 'high' | null;
  maxDrawdown: '5' | '10' | '20' | 'unlimited' | null;
  vaultName: string;
  description: string;
};

type ExistingVault = {
  id: string;
  chainVaultId: string;
  vaultName: string | null;
  category: string;
  cumulativePnlBps: number;
};

const STORAGE_KEY = 'alphyn-questionnaire';
const TOTAL_STEPS = 6;

// 3-level risk profile (maps to riskLevel 1-5 scale for backend compat)
const RISK_OPTIONS: Array<{ key: RiskKey; level: number; label: string; desc: string; icon: any; tone: string }> = [
  { key: 'conservative', level: 2, label: 'Conservative', desc: 'Stable, lower volatility. ~5–10% target APY.', icon: Shield,  tone: 'green' },
  { key: 'balanced',     level: 3, label: 'Balanced',     desc: 'Mix of growth and safety. ~10–20% target APY.', icon: Scale,   tone: 'blue'  },
  { key: 'aggressive',   level: 4, label: 'Aggressive',   desc: 'High volatility. 20%+ potential, larger drawdowns.', icon: Rocket, tone: 'orange' },
];

const TokenIcon = ({ symbol, className }: { symbol: string; className?: string }) => {
  if (symbol === 'ETH') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 2L4 13l8 4 8-4-8-11z" />
        <path d="M12 22l-8-9 8 4 8-4-8 9z" />
        <path d="M12 17v-4" />
        <path d="M4 13l8-4 8 4" />
      </svg>
    );
  }
  if (symbol === 'USDC') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    );
  }
  if (symbol === 'WBTC') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8.5 7h4a3 3 0 0 1 0 6h-4z" />
        <path d="M8.5 13h5a3 3 0 0 1 0 6h-5z" />
        <path d="M10 7v10" />
      </svg>
    );
  }
  if (symbol === 'ARB') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 3l-8 15h16L12 3z" />
        <path d="M12 12l-4 6" />
        <path d="M12 12l4 6" />
      </svg>
    );
  }
  return <div className={className} />;
};

export default function QuestionnairePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [authChecked, setAuthChecked] = useState(false);

  // Auth guard - redirect to / if not authenticated
  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (!res.ok) router.replace('/');
      else setAuthChecked(true);
    }).catch(() => router.replace('/'));
  }, [router]);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<StepData>({
    risk: null,
    horizon: null,
    assets: [],
    targetApy: null,
    maxDrawdown: null,
    vaultName: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing vault gate
  const [vaultCheckDone, setVaultCheckDone] = useState(false);
  const [existingVaults, setExistingVaults] = useState<ExistingVault[]>([]);
  const [proceedAnyway, setProceedAnyway] = useState(false);

  const checkVaults = useCallback(async () => {
    try {
      const res = await fetch('/api/vault/mine');
      if (res.ok) setExistingVaults(await res.json());
    } catch { /* not authed */ }
    finally { setVaultCheckDone(true); }
  }, []);

  useEffect(() => { checkVaults(); }, [checkVaults]);
  useEffect(() => { if (address && !proceedAnyway) checkVaults(); }, [address, checkVaults, proceedAnyway]);

  // Restore from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setData(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Save to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const updateData = (update: Partial<StepData>) => setData(prev => ({ ...prev, ...update }));

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const riskLevel = RISK_OPTIONS.find(r => r.key === data.risk)?.level ?? 3;
      const payload = {
        riskLevel,
        horizon: data.horizon,
        assets: data.assets,
        targetApy: data.targetApy,
        maxDrawdown: data.maxDrawdown,
        vaultName:   data.vaultName.trim() || undefined,
        description: data.description.trim() || undefined,
      };

      const response = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || 'Strategy generation failed');

      // Carry vaultName into preview/sessionStorage so register API picks it up via DB
      sessionStorage.setItem('alphyn-generated-strategy', JSON.stringify({
        ...result,
        vaultName: payload.vaultName,
        description: payload.description,
      }));
      router.push('/create/preview');
    } catch (err: any) {
      setError(err.message || 'Strategy generation failed. Please try again.');
      setLoading(false);
    }
  };

  if (!authChecked || !vaultCheckDone) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-alphyn-textMuted" />
      </div>
    );
  }

  // Existing-vault gate
  if (existingVaults.length > 0 && !proceedAnyway) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">You already have a vault</h1>
          <p className="text-alphyn-textMuted text-sm leading-relaxed">
            Your wallet has {existingVaults.length} active {existingVaults.length === 1 ? 'strategy' : 'strategies'}.
            Go back to your dashboard or create an additional vault.
          </p>
        </div>
        <div className="space-y-3">
          {existingVaults.map(v => {
            const pnl = v.cumulativePnlBps / 100;
            const isPos = pnl >= 0;
            return (
              <div
                key={v.id}
                onClick={() => router.push(`/vault/${v.chainVaultId}`)}
                className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-alphyn-surfaceBorder transition-colors group"
              >
                <div>
                  <p className="font-bold">{v.vaultName || `Vault ${v.chainVaultId.slice(2, 8)}`}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    v.category === 'aggressive' ? 'bg-orange-500/10 text-orange-400' :
                    v.category === 'balanced'   ? 'bg-blue-500/10 text-blue-400' :
                                                  'bg-green-500/10 text-green-400'
                  }`}>{v.category}</span>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black font-mono ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                    {isPos ? '+' : ''}{pnl.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-alphyn-textMuted group-hover:text-alphyn-orange transition-colors">Open →</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-alphyn-orange text-white font-bold rounded-2xl hover:bg-alphyn-orangeDeep transition-all flex items-center justify-center gap-2">
            <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
          </button>
          <button onClick={() => setProceedAnyway(true)} className="w-full py-4 bg-alphyn-surface border border-alphyn-surfaceBorder text-alphyn-textMuted hover:text-alphyn-orange font-bold rounded-2xl hover:border-alphyn-surfaceBorder transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Create Additional Strategy
          </button>
        </div>
        <p className="text-center text-[11px] text-alphyn-textMuted">
          Note: on-chain contracts currently support 1 vault per wallet.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-4">
        {error ? (
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-2xl font-bold">Generation Failed</h2>
            <p className="text-gray-400">{error}</p>
            <button onClick={() => setLoading(false)} className="px-6 py-2 bg-blue-500 text-white rounded-xl">Back to Questionnaire</button>
          </div>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <h2 className="text-2xl font-bold">
              AI is building {data.vaultName ? `"${data.vaultName}"` : 'your strategy'}...
            </h2>
            <p className="text-gray-400">This takes 3–8 seconds</p>
          </>
        )}
      </div>
    );
  }

  // ── disabled logic for next button ────────────────────────────────────
  const nextDisabled =
    (step === 1 && !data.risk) ||
    (step === 2 && !data.horizon) ||
    (step === 3 && data.assets.length === 0) ||
    (step === 4 && !data.targetApy) ||
    (step === 5 && !data.maxDrawdown);
    // step 6 is optional - never disabled

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-3">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-blue-500' : 'bg-alphyn-surfaceBorder'}`} />
        ))}
      </div>
      <p className="text-[11px] text-alphyn-textMuted uppercase tracking-widest font-bold mb-10">
        Step {step} of {TOTAL_STEPS}
      </p>

      <div className="bg-alphyn-surface border border-alphyn-surfaceBorder rounded-3xl p-8 shadow-xl">

        {/* ── STEP 1: Risk Tolerance (3 cards) ─────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black tracking-tight">What is your risk tolerance?</h1>
              <p className="text-alphyn-textMuted">Pick the profile that matches your comfort zone</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {RISK_OPTIONS.map(r => {
                const Icon = r.icon;
                const active = data.risk === r.key;
                const tone =
                  r.tone === 'green'  ? { ring: 'border-green-500',  bg: 'bg-green-500/10',  text: 'text-green-600' } :
                  r.tone === 'blue'   ? { ring: 'border-blue-500',   bg: 'bg-blue-500/10',   text: 'text-blue-600' } :
                                        { ring: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-600' };
                return (
                  <button
                    key={r.key}
                    onClick={() => updateData({ risk: r.key })}
                    className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                      active ? `${tone.ring} ${tone.bg}` : 'border-alphyn-surfaceBorder bg-background hover:bg-alphyn-surfaceHover'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${active ? tone.bg : 'bg-alphyn-surface'}`}>
                      <Icon className={`w-6 h-6 ${active ? tone.text : 'text-alphyn-textMuted'}`} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-lg ${active ? 'text-alphyn-text' : 'text-alphyn-textMuted'}`}>{r.label}</div>
                      <div className="text-sm text-alphyn-textMuted mt-0.5">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: Horizon ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black tracking-tight">Investment time horizon</h1>
              <p className="text-alphyn-textMuted">How long do you plan to hold?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'short', label: 'Short', desc: 'Under 3 months' },
                { id: 'mid',   label: 'Mid',   desc: '3–12 months' },
                { id: 'long',  label: 'Long',  desc: 'Over 12 months' },
              ].map(h => (
                <button
                  key={h.id}
                  onClick={() => updateData({ horizon: h.id as any })}
                  className={`p-6 rounded-2xl border-2 text-left transition-all shadow-sm ${
                    data.horizon === h.id ? 'border-blue-500 bg-blue-500/10 text-alphyn-text' : 'border-alphyn-surfaceBorder bg-background hover:bg-alphyn-surfaceHover text-alphyn-textMuted hover:text-alphyn-text'
                  }`}
                >
                  <div className="font-bold text-lg">{h.label}</div>
                  <div className="text-sm text-alphyn-textMuted mt-1">{h.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Assets ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black tracking-tight">Preferred assets</h1>
              <p className="text-alphyn-textMuted">Select at least one token</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { sym: 'ETH',  enabled: true,  reason: '' },
                { sym: 'USDC', enabled: true,  reason: '' },
                { sym: 'ARB',  enabled: false, reason: 'Low liquidity on testnet' },
                { sym: 'WBTC', enabled: false, reason: 'Low liquidity on testnet' },
              ].map(({ sym, enabled, reason }) => {
                const selected = data.assets.includes(sym as any);
                return (
                  <button
                    key={sym}
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return;
                      const next = selected ? data.assets.filter(a => a !== sym) : [...data.assets, sym as any];
                      updateData({ assets: next });
                    }}
                    className={`p-6 rounded-2xl border-2 flex items-center gap-4 transition-all relative shadow-sm ${
                      !enabled
                        ? 'border-alphyn-surfaceBorder bg-background/50 opacity-50 cursor-not-allowed'
                        : selected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-alphyn-surfaceBorder bg-background hover:bg-alphyn-surfaceHover'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                      !enabled ? 'bg-alphyn-surface border border-alphyn-surfaceBorder text-alphyn-textMuted/50' : 
                      selected ? 'bg-blue-500 text-white' : 
                      'bg-alphyn-surface border border-alphyn-surfaceBorder text-alphyn-textMuted'
                    }`}>
                      <TokenIcon symbol={sym} className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <div className={`font-bold text-lg ${!enabled ? 'text-alphyn-textMuted' : 'text-alphyn-text'}`}>{sym}</div>
                      {!enabled && (
                        <div className="text-[10px] text-orange-600 font-medium mt-0.5">{reason}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 4: Target APY ──────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black tracking-tight">Target APY</h1>
              <p className="text-alphyn-textMuted">Desired annual return</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'low',  label: 'Low (5–10%)',   desc: 'Predictable, lower risk' },
                { id: 'mid',  label: 'Mid (10–20%)',  desc: 'Balanced growth' },
                { id: 'high', label: 'High (20%+)',   desc: 'Higher target means higher risk', warning: true },
              ].map(a => (
                <button
                  key={a.id}
                  onClick={() => updateData({ targetApy: a.id as any })}
                  className={`p-6 rounded-2xl border-2 text-left transition-all shadow-sm ${
                    data.targetApy === a.id ? 'border-blue-500 bg-blue-500/10 text-alphyn-text' : 'border-alphyn-surfaceBorder bg-background hover:bg-alphyn-surfaceHover text-alphyn-textMuted hover:text-alphyn-text'
                  }`}
                >
                  <div className="font-bold text-lg">{a.label}</div>
                  <div className="text-sm text-alphyn-textMuted mt-1 flex items-center gap-2">
                    {a.warning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {a.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 5: Max Drawdown ────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black tracking-tight">Max drawdown</h1>
              <p className="text-alphyn-textMuted">Most you are willing to lose temporarily</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: '5',  label: '5%' },
                { id: '10', label: '10%' },
                { id: '20', label: '20%' },
                { id: 'unlimited', label: 'No Limit', warning: true },
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => updateData({ maxDrawdown: d.id as any })}
                  className={`p-6 rounded-2xl border-2 text-left transition-all shadow-sm ${
                    data.maxDrawdown === d.id ? 'border-blue-500 bg-blue-500/10 text-alphyn-text' : 'border-alphyn-surfaceBorder bg-background hover:bg-alphyn-surfaceHover text-alphyn-textMuted hover:text-alphyn-text'
                  }`}
                >
                  <div className="font-bold text-lg">{d.label}</div>
                  {d.warning && (
                    <div className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      You accept potentially losing your entire deposit.
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 6: Personalize ─────────────────────────────────────── */}
        {step === 6 && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 mb-2">
                <Sparkles className="w-3 h-3" /> Optional
              </div>
              <h1 className="text-3xl font-black tracking-tight">Make it yours</h1>
              <p className="text-alphyn-textMuted">Name your vault and add notes for the AI</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-alphyn-textMuted">
                  Vault Name
                </label>
                <input
                  type="text"
                  value={data.vaultName}
                  onChange={e => updateData({ vaultName: e.target.value.slice(0, 40) })}
                  placeholder="e.g. ETH Bullish Q2 2026"
                  className="w-full bg-background border border-alphyn-surfaceBorder rounded-2xl py-4 px-5 text-base font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
                <p className="text-[10px] text-alphyn-textMuted text-right">{data.vaultName.length}/40</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-alphyn-textMuted">
                  Strategy Notes for AI
                </label>
                <textarea
                  value={data.description}
                  onChange={e => updateData({ description: e.target.value.slice(0, 280) })}
                  placeholder="e.g. Focus on ETH. Avoid WBTC due to fees. Prefer holding through dips. Lean into ARB on dips."
                  rows={4}
                  className="w-full bg-background border border-alphyn-surfaceBorder rounded-2xl py-4 px-5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors resize-none"
                />
                <p className="text-[10px] text-alphyn-textMuted text-right">{data.description.length}/280</p>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-400/80 leading-relaxed">
                  The AI will read your notes when generating allocations and parameters.
                  More specific = more personalized strategy.
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center justify-between">
            {error}
            <button onClick={handleSubmit} className="px-4 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
              Retry
            </button>
          </div>
        )}

        <div className="mt-12 flex justify-between gap-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex-1 py-4 px-6 rounded-2xl border border-alphyn-surfaceBorder font-bold hover:bg-alphyn-surfaceHover disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={nextDisabled}
            className="flex-1 py-4 px-6 rounded-2xl bg-alphyn-orange text-white font-black hover:scale-[1.01] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5"
          >
            {step === TOTAL_STEPS ? 'Generate Strategy' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

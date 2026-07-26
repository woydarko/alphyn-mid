import React, { useState } from 'react';
import {
  generateStrategy,
  type Strategy,
  type Questionnaire as Q,
  type Horizon,
  type ApyBand,
  type Drawdown,
  type Asset,
  ASSETS,
} from './strategy';

type RiskKey = 'conservative' | 'balanced' | 'aggressive';
const RISK: Array<{ key: RiskKey; level: number; label: string; desc: string; icon: string }> = [
  { key: 'conservative', level: 2, label: 'Conservative', desc: 'Stable, lower volatility. Around 5 to 10% target APY.', icon: 'M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z' },
  { key: 'balanced', level: 3, label: 'Balanced', desc: 'A mix of growth and safety. Around 10 to 20% target APY.', icon: 'M12 3v18M5 8h14M6 8l-2 6a4 4 0 0 0 8 0l-2-6M14 8l-2 6a4 4 0 0 0 8 0l-2-6' },
  { key: 'aggressive', level: 4, label: 'Aggressive', desc: 'High volatility. 20%+ potential with larger drawdowns.', icon: 'M5 19l7-14 7 14M8 15h8' },
];

const TOTAL = 6;

export default function Questionnaire({
  onComplete,
  onCancel,
}: {
  onComplete: (s: Strategy) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [risk, setRisk] = useState<RiskKey | null>(null);
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [assets, setAssets] = useState<Asset[]>(['USDC', 'ETH']);
  const [targetApy, setTargetApy] = useState<ApyBand | null>(null);
  const [maxDrawdown, setMaxDrawdown] = useState<Drawdown | null>(null);
  const [vaultName, setVaultName] = useState('');
  const [description, setDescription] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  const nextDisabled =
    (step === 1 && !risk) ||
    (step === 2 && !horizon) ||
    (step === 3 && assets.length === 0) ||
    (step === 4 && !targetApy) ||
    (step === 5 && !maxDrawdown);

  const toggleAsset = (a: Asset) =>
    setAssets((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const q: Q = {
        riskLevel: RISK.find((r) => r.key === risk)!.level,
        horizon: horizon!,
        assets,
        targetApy: targetApy!,
        maxDrawdown: maxDrawdown!,
        vaultName: vaultName.trim() || undefined,
        description: description.trim() || undefined,
      };
      const s = await generateStrategy(q);
      setStrategy(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => (step < TOTAL ? setStep(step + 1) : generate());
  const back = () => (step > 1 ? setStep(step - 1) : onCancel());

  // ---- Strategy preview ----
  if (strategy) {
    const secs = strategy.epochDurationSeconds;
    const dur = secs >= 3600 ? `${Math.round(secs / 3600)}h` : `${Math.round(secs / 60)}m`;
    return (
      <div className="card">
        <div className="q-sub" style={{ marginBottom: 8 }}>
          {strategy.source === 'ai' ? 'AI generated' : 'Strategy engine'}
        </div>
        <h2 className="q-title">Your private strategy</h2>
        <p className="q-sub">
          These weights stay in your browser as witness data. Only a commitment goes on-chain.
        </p>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span className={`cat-pill cat-${strategy.category}`}>{strategy.category}</span>
        </div>

        <div className="alloc">
          {ASSETS.map((a, i) => (
            <div className="alloc-row" key={a}>
              <span className="alloc-name">{a}</span>
              <span className="alloc-track">
                <span className="alloc-fill" style={{ width: `${strategy.allocation[i]}%` }} />
              </span>
              <span className="alloc-pct">{strategy.allocation[i]}%</span>
            </div>
          ))}
        </div>

        <div className="params">
          <div className="param"><div className="pv">{strategy.rebalanceTriggerPct}%</div><div className="pl">Rebalance trigger</div></div>
          <div className="param"><div className="pv">{strategy.stopLossPct}%</div><div className="pl">Stop loss</div></div>
          <div className="param"><div className="pv">{dur}</div><div className="pl">Epoch duration</div></div>
          <div className="param"><div className="pv">{strategy.maxSlippageBps} bps</div><div className="pl">Max slippage</div></div>
        </div>

        {vaultName.trim() && (
          <p className="hint" style={{ marginTop: 14 }}>Vault name: <b>{vaultName.trim()}</b></p>
        )}

        <div className="wiz-nav">
          <button className="btn-ghost" onClick={() => setStrategy(null)}>Back to edit</button>
          <button className="btn-primary" onClick={() => onComplete(strategy)}>Use this strategy</button>
        </div>
      </div>
    );
  }

  // ---- Generating ----
  if (busy) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div className="q-title">Building your strategy…</div>
        <p className="q-sub">Turning your answers into a private allocation.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="progress">
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((s) => (
          <span key={s} className={`pbar ${s <= step ? 'on' : ''}`} />
        ))}
      </div>
      <p className="stepnum">Step {step} of {TOTAL}</p>

      {step === 1 && (
        <>
          <h2 className="q-title">What is your risk tolerance?</h2>
          <p className="q-sub">Pick the profile that matches your comfort zone.</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {RISK.map((r) => (
              <button key={r.key} className={`opt ${risk === r.key ? 'sel' : ''}`} onClick={() => setRisk(r.key)}>
                <span className="opt-ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={r.icon} />
                  </svg>
                </span>
                <span>
                  <div className="opt-title">{r.label}</div>
                  <div className="opt-desc">{r.desc}</div>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="q-title">Investment time horizon</h2>
          <p className="q-sub">How long do you plan to hold?</p>
          <div className="grid3">
            {([['short', 'Short', 'Under 3 months'], ['mid', 'Mid', '3 to 12 months'], ['long', 'Long', 'Over 12 months']] as const).map(
              ([id, label, desc]) => (
                <button key={id} className={`opt block ${horizon === id ? 'sel' : ''}`} onClick={() => setHorizon(id)}>
                  <div className="opt-title">{label}</div>
                  <div className="opt-desc">{desc}</div>
                </button>
              ),
            )}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="q-title">Preferred assets</h2>
          <p className="q-sub">Select at least one token. Order is fixed: USDC, ETH, BTC, ARB.</p>
          <div className="grid2">
            {ASSETS.map((a) => (
              <button key={a} className={`opt ${assets.includes(a) ? 'sel' : ''}`} onClick={() => toggleAsset(a)}>
                <span className="opt-ic">{a[0]}</span>
                <span className="opt-title">{a}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="q-title">Target APY</h2>
          <p className="q-sub">Desired annual return.</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {([['low', 'Low (5 to 10%)', 'Predictable, lower risk'], ['mid', 'Mid (10 to 20%)', 'Balanced growth'], ['high', 'High (20%+)', 'Higher target means higher risk']] as const).map(
              ([id, label, desc]) => (
                <button key={id} className={`opt block ${targetApy === id ? 'sel' : ''}`} onClick={() => setTargetApy(id)}>
                  <div className="opt-title">{label}</div>
                  <div className="opt-desc">{desc}</div>
                </button>
              ),
            )}
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <h2 className="q-title">Max drawdown</h2>
          <p className="q-sub">The most you are willing to lose temporarily.</p>
          <div className="grid2">
            {([['5', '5%', false], ['10', '10%', false], ['20', '20%', false], ['unlimited', 'No limit', true]] as const).map(
              ([id, label, warn]) => (
                <button key={id} className={`opt block ${maxDrawdown === id ? 'sel' : ''}`} onClick={() => setMaxDrawdown(id)}>
                  <div className="opt-title">{label}</div>
                  {warn && <div className="opt-warn">You accept losing your entire deposit.</div>}
                </button>
              ),
            )}
          </div>
        </>
      )}

      {step === 6 && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 8 }}><span className="opt-pill">Optional</span></div>
          <h2 className="q-title">Make it yours</h2>
          <p className="q-sub">Name your vault and add notes for the strategy engine.</p>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Vault name</label>
            <input className="text-full" value={vaultName} maxLength={40} placeholder="e.g. ETH bullish Q3"
              onChange={(e) => setVaultName(e.target.value)} />
            <div className="counter">{vaultName.length}/40</div>
          </div>
          <div>
            <label className="field-label">Strategy notes</label>
            <textarea rows={4} value={description} maxLength={280}
              placeholder="e.g. Focus on ETH, hold through dips, keep some USDC as ballast."
              onChange={(e) => setDescription(e.target.value)} />
            <div className="counter">{description.length}/280</div>
          </div>
        </>
      )}

      {error && (
        <div className="status" style={{ borderColor: 'var(--orange)', marginTop: 18 }}>❌ {error}</div>
      )}

      <div className="wiz-nav">
        <button className="btn-ghost" onClick={back}>{step === 1 ? 'Cancel' : 'Back'}</button>
        <button className="btn-primary" onClick={next} disabled={nextDisabled}>
          {step === TOTAL ? 'Generate strategy' : 'Next'}
        </button>
      </div>
    </div>
  );
}

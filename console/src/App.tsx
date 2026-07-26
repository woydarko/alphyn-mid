import React, { useEffect, useState } from 'react';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledAlphynContract } from './alphyn-contract';
import { connectWallet, buildProviders } from './providers';
import { createAlphynPrivateState, type AlphynPrivateState } from './witnesses';
import {
  PRIVATE_STATE_ID,
  categoryEnum,
  createVault,
  rebalance,
  readLeaderboard,
  type LeaderboardRow,
} from './alphyn-api';
import Questionnaire from './Questionnaire';
import { rand32, allocationBigints, type Strategy } from './strategy';

const CAT = ['conservative', 'balanced', 'aggressive'];
const ASSETS = ['USDC', 'ETH', 'BTC', 'ARB'];

type Phase = 'connecting' | 'need-wallet' | 'quiz' | 'minting' | 'active';

export default function App() {
  const [phase, setPhase] = useState<Phase>('connecting');
  const [providers, setProviders] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [, setPrivateState] = useState<AlphynPrivateState | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-connect on entry: the wallet was already authorized on the landing page,
  // so this is usually silent. No wallet -> show a connect prompt.
  const doConnect = async () => {
    setError(null);
    setPhase('connecting');
    try {
      const api = await connectWallet();
      const p = await buildProviders(api);
      setProviders(p);
      setPhase('quiz');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('need-wallet');
    }
  };

  useEffect(() => {
    doConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mint = commit this strategy on-chain: deploy a vault contract with the
  // allocation as private witness, then create the vault inside it. Deploying
  // (rather than joining a shared address) guarantees the on-chain verifier keys
  // match this exact build.
  const mint = async (s: Strategy) => {
    setStrategy(s);
    setPhase('minting');
    setError(null);
    try {
      setStatus('Deploying your vault contract…');
      const ps = createAlphynPrivateState(rand32(), allocationBigints(s), rand32());
      const deployed = await deployContract(providers, {
        compiledContract: CompiledAlphynContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: ps,
      });
      const addr = deployed.deployTxData.public.contractAddress;
      setContract(deployed);
      setPrivateState(ps);
      setVaultAddress(addr);
      setStatus('Committing your strategy on-chain (allocation stays private)…');
      await createVault(deployed, categoryEnum(s.category), BigInt(s.assetCount));
      setStatus('Vault minted.');
      setPhase('active');
      refreshBoard(addr);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPhase('active'); // let them see the dashboard / retry a rebalance
    }
  };

  const doRebalance = async () => {
    if (!contract) return;
    setBusy(true);
    setError(null);
    setStatus('Running an epoch — proving PnL followed your committed allocation…');
    try {
      // Demo oracle: ETH +3%, BTC -1% (order [USDC, ETH, BTC, ARB]).
      await rebalance(contract, [0n, 300n, 0n, 0n], [0n, 0n, 100n, 0n]);
      setStatus('Epoch complete. PnL proven in zero knowledge.');
      refreshBoard();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshBoard = async (addr?: string) => {
    const target = addr ?? vaultAddress;
    if (!target) return;
    try {
      const rows = await readLeaderboard(providers, target);
      setBoard(rows);
    } catch {
      /* ignore */
    }
  };

  const header = (
    <>
      <div className="brand">
        <span className="dot">A</span>
        <h1>Alphyn</h1>
      </div>
      <p className="subtitle">
        Privacy-first AI portfolio vault on Midnight. Your strategy stays private, every rebalance is proven in zero knowledge.
      </p>
    </>
  );

  // ---------- Connecting ----------
  if (phase === 'connecting') {
    return (
      <div className="app">
        {header}
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="q-title">Connecting your wallet…</div>
          <p className="q-sub">Approve the request in your wallet if it asks.</p>
        </div>
      </div>
    );
  }

  // ---------- No wallet ----------
  if (phase === 'need-wallet') {
    return (
      <div className="app">
        {header}
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="q-title">Connect your wallet to start</div>
          <p className="q-sub">
            Install a Midnight wallet (1AM or Lace), switch it to Preview, then connect.
          </p>
          {error && <div className="status" style={{ borderColor: 'var(--orange)', margin: '0 0 16px' }}>❌ {error}</div>}
          <button className="btn-primary" onClick={doConnect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  // ---------- Quiz ----------
  if (phase === 'quiz') {
    return (
      <div className="app">
        {header}
        <Questionnaire onComplete={mint} onCancel={() => { /* stay on quiz */ }} mintLabel="Mint this strategy" />
      </div>
    );
  }

  // ---------- Minting ----------
  if (phase === 'minting') {
    return (
      <div className="app">
        {header}
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="q-title">Minting your vault…</div>
          <p className="q-sub">{status}</p>
          <p className="hint">This runs a real zero-knowledge proof, so it takes a moment.</p>
        </div>
      </div>
    );
  }

  // ---------- Active (post-mint dashboard) ----------
  const secs = strategy?.epochDurationSeconds ?? 0;
  const dur = secs >= 3600 ? `${Math.round(secs / 3600)}h` : `${Math.round(secs / 60)}m`;
  return (
    <div className="app">
      {header}

      {strategy && (
        <div className="card">
          <div className="card-head">Your vault</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={`cat-pill cat-${strategy.category}`}>{strategy.category}</span>
            <span className="src-tag">{strategy.source === 'ai' ? 'AI generated' : 'Strategy engine'}</span>
          </div>
          <div className="alloc">
            {ASSETS.map((a, i) => (
              <div className="alloc-row" key={a}>
                <span className="alloc-name">{a}</span>
                <span className="alloc-track"><span className="alloc-fill" style={{ width: `${strategy.allocation[i]}%` }} /></span>
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
          <div className="row">
            <button className="btn-primary" onClick={doRebalance} disabled={busy || !contract}>Run epoch (rebalance)</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          Leaderboard (public ledger)
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => refreshBoard()} disabled={busy}>Refresh</button>
        </div>
        {board.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Vault</th><th>Category</th>
                <th className="num">Assets</th><th className="num">Epochs</th>
                <th className="num">Net PnL (×100 bps)</th><th className="num">Followers</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.id}>
                  <td className="mono" title={r.id}>{r.id.slice(0, 10)}…</td>
                  <td>{CAT[r.category] ?? r.category}</td>
                  <td className="num">{String(r.assetCount)}</td>
                  <td className="num">{String(r.epochCount)}</td>
                  <td className="num">{String(r.netPnlScaled)}</td>
                  <td className="num">{String(r.followers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="hint">Only aggregates are public. No allocation, no balance, no per-asset breakdown is ever shown.</div>
      </div>

      {(status || error) && (
        <div className="status" style={error ? { borderColor: 'var(--orange)' } : undefined}>
          {error ? `❌ ${error}` : `✅ ${status}`}
        </div>
      )}
      {vaultAddress && (
        <div className="contract"><span className="k">Vault</span><code>{vaultAddress}</code></div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledAlphynContract } from './alphyn-contract';
import { connectWallet, buildProviders } from './providers';
import { createAlphynPrivateState, type AlphynPrivateState } from './witnesses';
import {
  PRIVATE_STATE_ID,
  allocationForRisk,
  categoryForRisk,
  joinVaultContract,
  createVault,
  rebalance,
  follow,
  readLeaderboard,
  type LeaderboardRow,
} from './alphyn-api';

const rand = (n: number): Uint8Array => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
};
const CAT = ['conservative', 'balanced', 'aggressive'];

export default function App() {
  const [providers, setProviders] = useState<any>(null);
  // Pre-filled with the deployed Preview contract; deploy a new one to overwrite.
  const [address, setAddress] = useState('9afb6efaf563a9eceb7d97d9627ddb513432e9b67d8461eab151af553cd38be3');
  const [contract, setContract] = useState<any>(null);
  const [privateState, setPrivateState] = useState<AlphynPrivateState | null>(null);
  const [risk, setRisk] = useState(4);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [followTarget, setFollowTarget] = useState('');
  const [status, setStatus] = useState('Connect your wallet to begin. Make sure it is on Preview and the proof server is running.');
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
    } catch (e: any) {
      setStatus('❌ ' + (e?.message ?? String(e)));
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run('Connecting to your wallet...', async () => {
      const api = await connectWallet();
      const p = await buildProviders(api);
      setProviders(p);
      setStatus('✅ Connected. Deploy a new vault contract, or paste an existing address.');
    });

  const deploy = () =>
    run('Deploying - wallet balances, proves, submits...', async () => {
      const ps = createAlphynPrivateState(rand(32), allocationForRisk(risk), rand(32));
      const deployed = await deployContract(providers, {
        compiledContract: CompiledAlphynContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: ps,
      });
      const addr = deployed.deployTxData.public.contractAddress;
      setAddress(addr);
      setContract(deployed);
      setPrivateState(ps);
      setStatus('✅ Deployed at ' + addr);
      console.log('ALPHYN_CONTRACT_ADDRESS=' + addr);
    });

  const join = () =>
    run('Joining contract…', async () => {
      const ps = createAlphynPrivateState(rand(32), allocationForRisk(risk), rand(32));
      const c = await joinVaultContract(providers, address.trim(), ps);
      setContract(c);
      setPrivateState(ps);
      setStatus('✅ Joined ' + address.trim());
    });

  const doCreate = () =>
    run('Creating your vault (allocation stays private - only a commitment goes on-chain)…', async () => {
      const alloc = allocationForRisk(risk);
      const assetCount = BigInt(alloc.filter((w) => w > 0n).length);
      const res = await createVault(contract, categoryForRisk(risk), assetCount);
      setStatus('✅ Vault created. tx=' + (res?.public?.txId ?? 'ok'));
    });

  const doRebalance = () =>
    run('Rebalancing - ZK proves PnL followed your committed allocation…', async () => {
      // Demo oracle returns: ETH +3%, BTC -1% (index order [USDC, ETH, BTC, ARB]).
      const up = [0n, 300n, 0n, 0n];
      const down = [0n, 0n, 100n, 0n];
      const res = await rebalance(contract, up, down);
      setStatus('✅ Rebalanced. tx=' + (res?.public?.txId ?? 'ok'));
    });

  const doFollow = () =>
    run('Following (direction only - no strategy revealed)…', async () => {
      const hex = followTarget.trim().replace(/^0x/, '');
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
      const res = await follow(contract, bytes, 50n);
      setStatus('✅ Followed. tx=' + (res?.public?.txId ?? 'ok'));
    });

  const refreshBoard = () =>
    run('Reading public leaderboard…', async () => {
      const rows = await readLeaderboard(providers, address.trim());
      setBoard(rows);
      setStatus(`✅ Leaderboard: ${rows.length} vault(s).`);
    });

  const cat = CAT[Math.min(2, risk <= 2 ? 0 : risk === 3 ? 1 : 2)];

  return (
    <div className="app">
      <div className="brand">
        <span className="dot">A</span>
        <h1>Alphyn Console</h1>
      </div>
      <p className="subtitle">
        Privacy-first AI portfolio vault on Midnight. Deploy and drive the full ZK flow from your wallet.
      </p>

      {/* 1. Connect + contract */}
      <div className="card">
        <div className="card-head"><span className="step">1</span> Wallet &amp; contract</div>
        <div className="row">
          <button className={providers ? 'btn-ok' : 'btn-primary'} onClick={connect} disabled={busy}>
            {providers ? '✓ Wallet connected' : 'Connect Wallet'}
          </button>
          <button className="btn-ghost" onClick={deploy} disabled={busy || !providers}>
            Deploy new contract
          </button>
        </div>
        <div className="row">
          <input
            placeholder="…or paste existing contract address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button className="btn-ghost" onClick={join} disabled={busy || !providers || !address.trim()}>
            Join
          </button>
        </div>
      </div>

      {/* 2. My vault */}
      <div className="card">
        <div className="card-head"><span className="step">2</span> My vault</div>
        <div className="row">
          <span className="risk-label">Risk level: <b>{risk}</b> ({cat})</span>
          <input
            type="range"
            min={1}
            max={5}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
          />
        </div>
        <div className="hint">Allocation is derived locally and kept private. It never goes on-chain.</div>
        <div className="row">
          <button className="btn-primary" onClick={doCreate} disabled={busy || !contract}>
            Create my vault
          </button>
          <button className="btn-ghost" onClick={doRebalance} disabled={busy || !contract}>
            Rebalance (epoch)
          </button>
        </div>
        <div className="row">
          <input
            placeholder="target vault id (hex) to follow"
            value={followTarget}
            onChange={(e) => setFollowTarget(e.target.value)}
          />
          <button className="btn-ghost" onClick={doFollow} disabled={busy || !contract || !followTarget.trim()}>
            Follow @50%
          </button>
        </div>
      </div>

      {/* 3. Leaderboard */}
      <div className="card">
        <div className="card-head">
          <span className="step">3</span> Leaderboard (public ledger)
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={refreshBoard} disabled={busy || !providers || !address.trim()}>
            Refresh
          </button>
        </div>
        {board.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Vault</th>
                <th>Category</th>
                <th className="num">Assets</th>
                <th className="num">Epochs</th>
                <th className="num">Net PnL (×100 bps)</th>
                <th className="num">Followers</th>
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
        <div className="hint">
          Only aggregates are public. No allocation, no balance, no per-asset breakdown is ever shown.
        </div>
      </div>

      <div className="status">{status}</div>
      {address && (
        <div className="contract">
          <span className="k">Contract</span>
          <code>{address}</code>
        </div>
      )}
    </div>
  );
}

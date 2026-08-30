// Local execution bridge + keeper for Alphyn.
//
// Mirrors the original Alphyn architecture: a long-running operator wallet runs
// the on-chain work and the browser is pure UI. Two roles in one process:
//   1. Executor  — HTTP API the browser calls to mint / rename / fund / close.
//   2. Keeper    — a background loop that runs an epoch (rebalance) for every
//                  active vault on a fixed cadence, exactly like the old keeper.
//
// The extensions have moved to the v9 transaction line the public compiler
// cannot target yet; the node still accepts the v8 line this wallet speaks. The
// vault secrets live HERE, on the user's own machine (bridge-vaults.json), so
// this is self-custody, not a third-party operator. Nothing private is exposed
// on-chain beyond the commitment and aggregates.
//
// Run: cd deploy && MIDNIGHT_NETWORK=preview npm run bridge   (proof server :6300)

import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bip39 from 'bip39';
import { resolveConfig, ZK_CONFIG_PATH } from './config.js';
import { buildWallet, configureProviders } from './wallet.js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract as AlphynContract, ledger } from '../managed/alphyn/contract/index.js';

const PORT = Number(process.env.BRIDGE_PORT ?? 6363);
// Demo-friendly keeper cadence: one epoch per active vault every this many
// seconds, regardless of the vault's nominal epoch duration. Set higher in
// production, or honor per-vault cadence.
const KEEPER_SECONDS = Number(process.env.KEEPER_INTERVAL_SECONDS ?? 300);
const here = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(here, '..', 'bridge-vaults.json');

const toHex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const fromHex = (h: string) => Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));
const rand32 = () => Uint8Array.from(bip39.mnemonicToSeedSync(bip39.generateMnemonic()).subarray(0, 32));

interface Epoch { n: number; pnlBps: number; ts: number }
interface VaultRec {
  vaultId: string;
  psId: string;
  owner: string | null; // the user wallet address that authorized this vault
  secretHex: string;
  nonceHex: string;
  name: string;
  category: number;
  allocation: number[];
  assetCount: number;
  epochDurationSeconds: number;
  rebalanceTriggerPct: number;
  stopLossPct: number;
  maxSlippageBps: number;
  principal: number;
  epochs: Epoch[];
  following: string | null;
  active: boolean;
  createdAt: number;
  lastEpochTs: number;
}
type Store = Record<string, VaultRec>;

const loadStore = (): Store => {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return {};
  }
};
const saveStore = (s: Store) => fs.writeFileSync(STORE, JSON.stringify(s, null, 2));

// Public projection sent to the browser: no secrets.
const pub = (r: VaultRec) => ({
  vaultId: r.vaultId,
  owner: r.owner ?? null,
  name: r.name,
  category: r.category,
  allocation: r.allocation,
  assetCount: r.assetCount,
  epochDurationSeconds: r.epochDurationSeconds,
  rebalanceTriggerPct: r.rebalanceTriggerPct,
  stopLossPct: r.stopLossPct,
  maxSlippageBps: r.maxSlippageBps,
  principal: r.principal,
  epochs: r.epochs,
  following: r.following,
  active: r.active,
  createdAt: r.createdAt,
});

// Dust (the fee resource) regenerates from registered NIGHT over time. Under a
// burst of transactions it can run dry; instead of failing, wait for it to
// regenerate and retry.
const isDustError = (e: any) => /could not balance dust|InsufficientFunds/i.test(String(e?.message ?? e));
const withDustRetry = async <T>(label: string, fn: () => Promise<T>, tries = 8, delayMs = 20000): Promise<T> => {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < tries && isDustError(e)) {
        console.log(`⏳ ${label}: low dust, waiting ${Math.round(delayMs / 1000)}s for regen (try ${i + 1}/${tries})`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
};

const witnesses = {
  localSecretKey: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.secretKey],
  allocation: ({ privateState }: any): [any, bigint[]] => [privateState, [...privateState.allocation]],
  allocationNonce: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.nonce],
};
const psFromRec = (r: VaultRec) => ({
  secretKey: fromHex(r.secretHex),
  allocation: r.allocation.map(BigInt) as [bigint, bigint, bigint, bigint],
  nonce: fromHex(r.nonceHex),
});

// Real per-asset 24h returns → up/down bps, clamped. Order [USDC, ETH, BTC, ARB].
const ORACLE_IDS = ['usd-coin', 'ethereum', 'bitcoin', 'arbitrum'];
async function fetchOracle(): Promise<{ up: number[]; down: number[] }> {
  const flat = { up: [0, 0, 0, 0], down: [0, 0, 0, 0] };
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ORACLE_IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) return flat;
    const data: any = await res.json();
    const up = [0, 0, 0, 0];
    const down = [0, 0, 0, 0];
    ORACLE_IDS.forEach((id, i) => {
      const bps = (data[id]?.usd_24h_change ?? 0) * 100;
      const c = Math.max(0, Math.min(2000, Math.round(Math.abs(bps))));
      if (bps >= 0) up[i] = c;
      else down[i] = c;
    });
    return { up, down };
  } catch {
    return flat;
  }
}

async function main() {
  const config = resolveConfig();
  const addr = (process.env.ALPHYN_CONTRACT_ADDRESS ?? '').trim()
    || fs.readFileSync(path.resolve(here, '..', 'deployed-address.txt'), 'utf8').trim();
  if (!addr) throw new Error('no contract address (ALPHYN_CONTRACT_ADDRESS or deployed-address.txt)');

  console.log('▶ Building operator wallet (one-time sync)…');
  const seed = Uint8Array.from(bip39.mnemonicToSeedSync((process.env.DEPLOYER_SEED ?? '').trim()));
  const ctx = await buildWallet(config, seed);
  const providers = await configureProviders(ctx, config);
  console.log('▶ Wallet ready. Contract:', addr);

  const compiled = CompiledContract.make('alphyn', AlphynContract as any).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );
  const contracts = new Map<string, any>();
  const joinAs = async (psId: string, ps: any) => {
    let c = contracts.get(psId);
    if (!c) {
      c = await findDeployedContract(providers as any, {
        contractAddress: addr,
        compiledContract: compiled as any,
        privateStateId: psId,
        initialPrivateState: ps,
      });
      contracts.set(psId, c);
    }
    return c;
  };

  const leaderboardRows = async () => {
    const st = await (providers as any).publicDataProvider.queryContractState(addr);
    if (!st) return [];
    const l = ledger(st.data);
    const rows: any[] = [];
    for (const [id, v] of l.vaults) {
      rows.push({
        id: toHex(id),
        category: Number(v.category),
        assetCount: String(v.assetCount),
        epochCount: String(v.epochCount),
        netPnlScaled: String(v.gainScaled - v.lossScaled),
        followers: String(v.followers),
        active: v.active,
      });
    }
    return rows;
  };

  // One wallet ⇒ serialize every tx-producing op (keeper and API share it).
  let chain: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };

  const runEpochFor = (r: VaultRec) =>
    serialized(async () => {
      const c = await joinAs(r.psId, psFromRec(r));
      const { up, down } = await fetchOracle();
      const tx = await withDustRetry('rebalance', () => c.callTx.rebalance(up.map(BigInt), down.map(BigInt)));
      const num = r.allocation.reduce((acc, w, i) => acc + w * up[i] - w * down[i], 0);
      const pnlBps = Math.round(num / 100);
      const store = loadStore();
      const cur = store[r.vaultId];
      if (cur) {
        cur.epochs.push({ n: cur.epochs.length + 1, pnlBps, ts: Date.now() });
        cur.lastEpochTs = Date.now();
        saveStore(store);
      }
      return tx?.public?.txId ?? null;
    });

  // ── Keeper loop ──────────────────────────────────────────────────────────
  let keeperBusy = false;
  const keeperTick = async () => {
    if (keeperBusy) return;
    keeperBusy = true;
    try {
      const store = loadStore();
      const now = Date.now();
      for (const r of Object.values(store)) {
        if (!r.active) continue;
        if ((r.principal ?? 0) <= 0) continue; // a vault has nothing to manage until it is funded
        if (now - (r.lastEpochTs ?? 0) < KEEPER_SECONDS * 1000) continue;
        try {
          const tx = await runEpochFor(r);
          console.log(`⏱  keeper epoch ${r.vaultId.slice(0, 10)} tx ${tx ?? 'ok'}`);
        } catch (e: any) {
          console.error(`⏱  keeper epoch failed ${r.vaultId.slice(0, 10)}:`, e?.message ?? e);
        }
      }
    } finally {
      keeperBusy = false;
    }
  };
  setInterval(keeperTick, Math.max(10, Math.floor(KEEPER_SECONDS / 4)) * 1000);
  console.log(`▶ Keeper armed: one epoch per active vault every ~${KEEPER_SECONDS}s.`);

  const handlers: Record<string, (body: any) => Promise<any>> = {
    'GET /health': async () => ({ ok: true, contract: addr, mode: 'bridge', keeperSeconds: KEEPER_SECONDS }),
    'GET /leaderboard': async () => leaderboardRows(),
    'GET /vaults': async () => Object.values(loadStore()).map(pub),

    'POST /mint': (body) =>
      serialized(async () => {
        const { allocation, category, assetCount, name, epochDurationSeconds, rebalanceTriggerPct, stopLossPct, maxSlippageBps, secretHex, nonceHex, owner } = body;
        if (!Array.isArray(allocation) || allocation.length !== 4) throw new Error('allocation must be [4]');
        const psId = `alphyn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        // The vault secret is derived from the USER's wallet signature and passed
        // in, so the vault (vaultId = hash(secret)) belongs to their key. The
        // operator only relays. Fall back to a random secret if none is supplied.
        const draft: VaultRec = {
          vaultId: '', psId, owner: owner ?? null,
          secretHex: (secretHex as string) || toHex(rand32()),
          nonceHex: (nonceHex as string) || toHex(rand32()),
          name: (name ?? '').trim() || 'Vault',
          category: Number(category), allocation, assetCount: Number(assetCount),
          epochDurationSeconds: Number(epochDurationSeconds ?? 3600),
          rebalanceTriggerPct: Number(rebalanceTriggerPct ?? 4),
          stopLossPct: Number(stopLossPct ?? 12),
          maxSlippageBps: Number(maxSlippageBps ?? 50),
          principal: 0, epochs: [], following: null, active: true,
          createdAt: Date.now(), lastEpochTs: 0,
        };
        const c = await joinAs(psId, psFromRec(draft));
        const before = new Set((await leaderboardRows()).map((r) => r.id));
        const tx = await withDustRetry('createVault', () => c.callTx.createVault(draft.category, BigInt(draft.assetCount)));
        const after = await leaderboardRows();
        const vaultId = after.find((r) => !before.has(r.id))?.id ?? psId;
        draft.vaultId = vaultId;
        if (!draft.name || draft.name === 'Vault') draft.name = `Vault ${vaultId.slice(0, 6)}`;
        const store = loadStore();
        store[vaultId] = draft;
        saveStore(store);
        // txHash is the on-chain hash the block explorer indexes; txId is a
        // different internal identifier (carries a tag byte) and 404s on the explorer.
        const txHash = tx?.public?.txHash ?? null;
        console.log('✓ mint vault', vaultId.slice(0, 12), 'txHash', txHash ?? 'ok');
        return { vault: pub(draft), txId: tx?.public?.txId ?? null, txHash };
      }),

    'POST /epoch': async (body) => {
      const r = loadStore()[body.vaultId];
      if (!r) throw new Error('unknown vault');
      if ((r.principal ?? 0) <= 0) throw new Error('Fund this vault first: deposit tNIGHT via Deposit.');
      const txId = await runEpochFor(r);
      return { txId };
    },

    'POST /principal': async (body) => {
      const store = loadStore();
      const r = store[body.vaultId];
      if (!r) throw new Error('unknown vault');
      r.principal = Math.max(0, Number(body.amount) || 0);
      saveStore(store);
      return { ok: true, principal: r.principal };
    },
    'POST /rename': async (body) => {
      const store = loadStore();
      const r = store[body.vaultId];
      if (!r) throw new Error('unknown vault');
      r.name = String(body.name ?? r.name).slice(0, 60);
      saveStore(store);
      return { ok: true };
    },

    'POST /follow': (body) =>
      serialized(async () => {
        const r = loadStore()[body.vaultId];
        if (!r) throw new Error('unknown vault');
        const c = await joinAs(r.psId, psFromRec(r));
        const tx = await withDustRetry('follow', () => c.callTx.follow(fromHex(body.targetId), BigInt(body.pct ?? 50)));
        const store = loadStore();
        if (store[body.vaultId]) { store[body.vaultId].following = body.targetId; saveStore(store); }
        return { txId: tx?.public?.txId ?? null };
      }),
    'POST /unfollow': (body) =>
      serialized(async () => {
        const r = loadStore()[body.vaultId];
        if (!r) throw new Error('unknown vault');
        const c = await joinAs(r.psId, psFromRec(r));
        const tx = await withDustRetry('unfollow', () => c.callTx.unfollow());
        const store = loadStore();
        if (store[body.vaultId]) { store[body.vaultId].following = null; saveStore(store); }
        return { txId: tx?.public?.txId ?? null };
      }),
    'POST /close': (body) =>
      serialized(async () => {
        const r = loadStore()[body.vaultId];
        if (!r) throw new Error('unknown vault');
        const c = await joinAs(r.psId, psFromRec(r));
        const tx = await withDustRetry('closeVault', () => c.callTx.closeVault());
        const store = loadStore();
        if (store[body.vaultId]) { store[body.vaultId].active = false; saveStore(store); }
        return { txId: tx?.public?.txId ?? null };
      }),
  };

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin ?? '';
    const cors = /^http:\/\/localhost:(3000|5173|5178)$/.test(origin) ? origin : 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', cors);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const key = `${req.method} ${new URL(req.url ?? '/', 'http://x').pathname}`;
    const h = handlers[key];
    if (!h) return res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}');

    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', async () => {
      try {
        const out = await h(raw ? JSON.parse(raw) : {});
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e: any) {
        console.error('✗', key, e?.message ?? e);
        res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e?.message ?? String(e) }));
      }
    });
  });
  server.listen(PORT, () => console.log(`▶ Alphyn bridge listening on http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error('BRIDGE FAILED:', e);
  process.exit(1);
});

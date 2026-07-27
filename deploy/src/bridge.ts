// Local execution bridge: the browser UI talks to this instead of the wallet
// extension while the extension is on the v9 transaction line and the public
// compiler is still on v8.
//
// It mirrors the old Alphyn architecture: a long-running operator wallet (the
// deploy seed) executes createVault / rebalance / follow / close, and the
// browser is pure UI. Vault secrets are generated and kept HERE, on the user's
// own machine, in bridge-vaults.json next to this file. Nothing private ever
// leaves localhost.
//
// Run: MIDNIGHT_NETWORK=preview npx tsx src/bridge.ts   (proof server on :6300)

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
const here = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(here, '..', 'bridge-vaults.json');

const toHex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const fromHex = (h: string) => Uint8Array.from(Buffer.from(h.replace(/^0x/, ''), 'hex'));
const rand32 = () => Uint8Array.from(bip39.mnemonicToSeedSync(bip39.generateMnemonic()).subarray(0, 32));

interface VaultRec {
  psId: string;
  secretHex: string;
  nonceHex: string;
  allocation: number[];
  category: number;
  assetCount: number;
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

  // All tx-producing ops share one wallet, so serialize them.
  let chain: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };

  const handlers: Record<string, (body: any) => Promise<any>> = {
    'GET /health': async () => ({ ok: true, contract: addr, mode: 'bridge' }),
    'GET /leaderboard': async () => leaderboardRows(),

    'POST /mint': (body) =>
      serialized(async () => {
        const { allocation, category, assetCount } = body;
        if (!Array.isArray(allocation) || allocation.length !== 4) throw new Error('allocation must be [4]');
        const rec: VaultRec = {
          psId: `alphyn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          secretHex: toHex(rand32()),
          nonceHex: toHex(rand32()),
          allocation,
          category: Number(category),
          assetCount: Number(assetCount),
        };
        const c = await joinAs(rec.psId, psFromRec(rec));
        const before = new Set((await leaderboardRows()).map((r) => r.id));
        const tx = await c.callTx.createVault(rec.category, BigInt(rec.assetCount));
        const after = await leaderboardRows();
        const vaultId = after.find((r) => !before.has(r.id))?.id ?? rec.psId;
        const store = loadStore();
        store[vaultId] = rec;
        saveStore(store);
        console.log('✓ mint vault', vaultId.slice(0, 12), 'tx', tx?.public?.txId ?? 'ok');
        return { vaultId, txId: tx?.public?.txId ?? null, leaderboard: after };
      }),

    'POST /epoch': (body) =>
      serialized(async () => {
        const { vaultId, up, down } = body;
        const rec = loadStore()[vaultId];
        if (!rec) throw new Error('unknown vault (not managed by this bridge)');
        const c = await joinAs(rec.psId, psFromRec(rec));
        const tx = await c.callTx.rebalance((up ?? [0, 0, 0, 0]).map(BigInt), (down ?? [0, 0, 0, 0]).map(BigInt));
        console.log('✓ epoch vault', vaultId.slice(0, 12), 'tx', tx?.public?.txId ?? 'ok');
        return { txId: tx?.public?.txId ?? null };
      }),

    'POST /follow': (body) =>
      serialized(async () => {
        const { vaultId, targetId, pct } = body;
        const rec = loadStore()[vaultId];
        if (!rec) throw new Error('unknown vault (not managed by this bridge)');
        const c = await joinAs(rec.psId, psFromRec(rec));
        const tx = await c.callTx.follow(fromHex(targetId), BigInt(pct ?? 50));
        return { txId: tx?.public?.txId ?? null };
      }),

    'POST /unfollow': (body) =>
      serialized(async () => {
        const rec = loadStore()[body.vaultId];
        if (!rec) throw new Error('unknown vault (not managed by this bridge)');
        const c = await joinAs(rec.psId, psFromRec(rec));
        const tx = await c.callTx.unfollow();
        return { txId: tx?.public?.txId ?? null };
      }),

    'POST /close': (body) =>
      serialized(async () => {
        const rec = loadStore()[body.vaultId];
        if (!rec) throw new Error('unknown vault (not managed by this bridge)');
        const c = await joinAs(rec.psId, psFromRec(rec));
        const tx = await c.callTx.closeVault();
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
        const body = raw ? JSON.parse(raw) : {};
        const out = await h(body);
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

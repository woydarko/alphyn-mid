// Live on-chain interaction against the deployed Alphyn contract:
// join → createVault → rebalance → read leaderboard. Proves the ZK circuits
// work end-to-end on Preview (not just deploy), and seeds real leaderboard data.
//
// This IS the keeper loop's core (join + rebalance), wired to the live contract.

import 'dotenv/config';
import * as bip39 from 'bip39';
import { resolveConfig, ZK_CONFIG_PATH, PRIVATE_STATE_ID } from './config.js';
import { buildWallet, configureProviders } from './wallet.js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract as AlphynContract, ledger, Category } from '../managed/alphyn/contract/index.js';

const rand = (n: number) => Uint8Array.from(bip39.mnemonicToSeedSync(bip39.generateMnemonic()).subarray(0, n));

const witnesses = {
  localSecretKey: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.secretKey],
  allocation: ({ privateState }: any): [any, bigint[]] => [privateState, [...privateState.allocation]],
  allocationNonce: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.nonce],
};

// A concrete, private allocation summing to 100: [USDC, ETH, BTC, ARB].
const privateState = {
  secretKey: rand(32),
  allocation: [20n, 40n, 30n, 10n] as [bigint, bigint, bigint, bigint],
  nonce: rand(32),
};

async function readLeaderboard(providers: any, addr: string) {
  const st = await providers.publicDataProvider.queryContractState(addr);
  if (!st) return console.log('  (no contract state)');
  const l = ledger(st.data);
  console.log(`  vaultCount = ${l.vaultCount}`);
  let i = 0;
  for (const [, v] of l.vaults) {
    const net = v.gainScaled - v.lossScaled;
    console.log(`  vault#${i++}: cat=${v.category} assets=${v.assetCount} epochs=${v.epochCount} netPnL(scaled)=${net} followers=${v.followers} active=${v.active}`);
  }
}

async function main() {
  const config = resolveConfig();
  const addr = (process.env.ALPHYN_CONTRACT_ADDRESS ?? '').trim();
  if (!addr) throw new Error('ALPHYN_CONTRACT_ADDRESS missing');

  console.log('▶ Building wallet…');
  const seed = Uint8Array.from(bip39.mnemonicToSeedSync((process.env.DEPLOYER_SEED ?? '').trim()));
  const ctx = await buildWallet(config, seed);

  console.log('▶ Configuring providers…');
  const providers = await configureProviders(ctx, config);

  const compiled = CompiledContract.make('alphyn', AlphynContract as any).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );

  console.log(`▶ Joining contract ${addr.slice(0, 12)}…`);
  const contract: any = await findDeployedContract(providers as any, {
    contractAddress: addr,
    compiledContract: compiled as any,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });

  console.log('▶ Leaderboard BEFORE:');
  await readLeaderboard(providers, addr);

  console.log('▶ createVault (allocation stays private; only commitment on-chain)…');
  const cv = await contract.callTx.createVault(Category.aggressive, 3n);
  console.log('  ✓ createVault tx=' + (cv?.public?.txId ?? 'ok'));

  console.log('▶ rebalance (ZK proves PnL followed committed allocation)…');
  const rb = await contract.callTx.rebalance([0n, 300n, 0n, 0n], [0n, 0n, 100n, 0n]); // ETH +3%, BTC -1%
  console.log('  ✓ rebalance tx=' + (rb?.public?.txId ?? 'ok'));

  console.log('▶ Leaderboard AFTER:');
  await readLeaderboard(providers, addr);

  console.log('\n✅ Live circuit calls succeeded on Preview.');
  process.exit(0);
}

main().catch((e) => { console.error('INTERACT FAILED:', e); process.exit(1); });

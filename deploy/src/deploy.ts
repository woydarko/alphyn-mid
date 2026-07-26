// Deploy the Alphyn contract to Midnight Preprod using the funded wallet.
//
// Seed handling: 1AM uses standard BIP39 — mnemonic -> 64-byte PBKDF2 seed,
// account 0, index 0 (verified: reproduces the funded unshielded address).

import 'dotenv/config';
import * as bip39 from 'bip39';
import { writeFileSync } from 'node:fs';
import { resolveConfig, ZK_CONFIG_PATH, PRIVATE_STATE_ID } from './config.js';
import { buildWallet, configureProviders } from './wallet.js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
// Contract bindings copied next to this package (native FS) — see run-deploy.sh.
import { Contract as AlphynContract } from '../managed/alphyn/contract/index.js';

// Witness implementations (inline; must match the names in alphyn.compact).
const witnesses = {
  localSecretKey: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.secretKey],
  allocation: ({ privateState }: any): [any, bigint[]] => [privateState, [...privateState.allocation]],
  allocationNonce: ({ privateState }: any): [any, Uint8Array] => [privateState, privateState.nonce],
};

// Deployer placeholder private state (deploy does not invoke witness circuits).
const initialPrivateState = {
  secretKey: new Uint8Array(32),
  allocation: [25n, 25n, 25n, 25n] as [bigint, bigint, bigint, bigint],
  nonce: new Uint8Array(32),
};

async function main() {
  const config = resolveConfig();
  const mnemonic = (process.env.DEPLOYER_SEED ?? '').trim();
  if (!mnemonic) throw new Error('DEPLOYER_SEED missing in .env');

  console.log('▶ Building wallet from seed…');
  const seed = Uint8Array.from(bip39.mnemonicToSeedSync(mnemonic)); // 64B PBKDF2
  const ctx = await buildWallet(config, seed);

  console.log('▶ Configuring providers…');
  const providers = await configureProviders(ctx, config);

  console.log('▶ Preparing compiled contract…');
  const compiled = CompiledContract.make('alphyn', AlphynContract as any).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );

  console.log('▶ Deploying to Preprod (proof generation may take a minute)…');
  const deployed = await deployContract(providers as any, {
    compiledContract: compiled as any,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
  });

  const addr = deployed.deployTxData.public.contractAddress;
  console.log('\n────────────────────────────────────────');
  console.log('✅ DEPLOYED — contract address:');
  console.log(`   ${addr}`);
  console.log('────────────────────────────────────────');
  writeFileSync('deployed-address.txt', String(addr));
  process.exit(0);
}

main().catch((e) => {
  console.error('DEPLOY FAILED:', e);
  process.exit(1);
});

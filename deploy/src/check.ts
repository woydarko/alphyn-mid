// Quick balance check: build wallet, sync (fast on Preview), print balance, exit.
import 'dotenv/config';
import * as bip39 from 'bip39';
import { resolveConfig } from './config.js';
import { buildWallet } from './wallet.js';

async function main() {
  const config = resolveConfig();
  const mnemonic = (process.env.DEPLOYER_SEED ?? '').trim();
  const seed = Uint8Array.from(bip39.mnemonicToSeedSync(mnemonic));
  await buildWallet(config, seed, { requireFunds: false });
  console.log('CHECK DONE');
  process.exit(0);
}
main().catch((e) => { console.error('CHECK FAILED:', e?.message ?? e); process.exit(1); });

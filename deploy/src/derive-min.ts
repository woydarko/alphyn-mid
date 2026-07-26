// Minimal, dependency-light address derivation — avoids the heavy ledger-v8 /
// wallet-facade wasm imports so it runs instantly. Confirms whether the provided
// mnemonic reproduces the funded wallet before we touch the full deploy path.

import 'dotenv/config';
import * as bip39 from 'bip39';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js/network-id';

const toBytes = (v: string | Uint8Array): Uint8Array =>
  typeof v === 'string' ? Uint8Array.from(Buffer.from(v, 'hex')) : Uint8Array.from(v);

function addressFromSeed(seed: Uint8Array, account = 0, index = 0): string {
  const hd = HDWallet.fromSeed(seed);
  if (hd.type !== 'seedOk') throw new Error('HDWallet.fromSeed failed');
  const res = hd.hdWallet.selectAccount(account).selectRoles([Roles.NightExternal]).deriveKeysAt(index);
  if (res.type !== 'keysDerived') throw new Error('key derivation failed');
  hd.hdWallet.clear();
  return createKeystore(res.keys[Roles.NightExternal], getNetworkId()).getBech32Address();
}

const mnemonic = (process.env.DEPLOYER_SEED ?? '').trim();
const expected = (process.env.DEPLOYER_ADDRESS ?? '').trim();
if (!mnemonic) throw new Error('DEPLOYER_SEED missing');

setNetworkId((process.env.MIDNIGHT_NETWORK as any) ?? 'preview');

console.log(`words: ${mnemonic.split(/\s+/).length}  bip39-valid: ${bip39.validateMnemonic(mnemonic)}`);
console.log(`expected: ${expected}\n`);

const seeds: Record<string, Uint8Array> = {};
try { seeds['entropy'] = toBytes(bip39.mnemonicToEntropy(mnemonic)); } catch (e) { console.log('entropy fail:', (e as Error).message); }
try { seeds['pbkdf2'] = toBytes(bip39.mnemonicToSeedSync(mnemonic)); } catch (e) { console.log('pbkdf2 fail:', (e as Error).message); }

let matched = false;
for (const [name, seed] of Object.entries(seeds)) {
  // Try account/index 0,0 (standard) and a couple of fallbacks in case 1AM differs.
  for (const [acc, idx] of [[0, 0], [0, 1], [1, 0]] as const) {
    try {
      const addr = addressFromSeed(seed, acc, idx);
      const hit = expected && addr === expected;
      matched ||= Boolean(hit);
      console.log(`${name} acct${acc}/idx${idx} [${seed.length}B] -> ${addr}${hit ? '  <== MATCH ✅' : ''}`);
    } catch (e) {
      console.log(`${name} acct${acc}/idx${idx} -> ERROR: ${(e as Error).message}`);
    }
  }
}

console.log('');
console.log(matched
  ? 'MATCH — CLI reproduces your funded wallet. Safe to deploy.'
  : expected
    ? 'NO MATCH — 1AM uses a different derivation. Fund the CLI address above, or deploy in-browser.'
    : 'Compare the addresses above to your 1AM unshielded address.');

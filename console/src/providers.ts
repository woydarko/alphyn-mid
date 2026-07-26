// Connect 1AM/Lace (DApp connector v4) and build midnight-js providers from it.
// The wallet balances + proves + submits, using ITS already-synced state - so no
// cold headless sync. Adapted from example-bboard's BrowserDeployedBoardManager.

import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import semver from 'semver';

const COMPATIBLE_CONNECTOR = '4.x';
export const NETWORK_ID = 'preview';

function getWallet(): any {
  const w = (window as any).midnight;
  if (!w) return undefined;
  return Object.values(w).find(
    (x: any) => x && typeof x === 'object' && 'apiVersion' in x && semver.satisfies(x.apiVersion, COMPATIBLE_CONNECTOR),
  );
}

export async function connectWallet(): Promise<any> {
  const initial = getWallet();
  if (!initial) {
    throw new Error('No compatible wallet found. Install a Midnight wallet (e.g. 1AM) and switch it to Preview.');
  }
  const api = await initial.connect(NETWORK_ID);
  await api.getConnectionStatus();
  return api;
}

export async function buildProviders(connectedAPI: any) {
  // ZK keys/zkir are served from this app's base path (see vite `base`), so the
  // config base must include it. Works both standalone and behind the /app proxy.
  const zkBase = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const zk = new FetchZkConfigProvider(zkBase, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  const priv = inMemoryPrivateStateProvider();
  const shielded = await connectedAPI.getShieldedAddresses();

  return {
    privateStateProvider: priv,
    zkConfigProvider: zk,
    proofProvider: httpClientProofProvider(config.proverServerUri, zk),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey() {
        return shielded.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey() {
        return shielded.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: any): Promise<any> => {
        const serialized = toHex(tx.serialize());
        const received = await connectedAPI.balanceUnsealedTransaction(serialized);
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: any): Promise<any> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
}

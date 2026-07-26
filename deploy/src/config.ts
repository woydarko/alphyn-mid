import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';

const here = path.dirname(fileURLToPath(import.meta.url));

// Absolute path to the compiled contract assets (circuits + keys + bindings).
// Overridable via env so the deploy package can run from a fast native FS while
// reading the assets from their repo location.
export const ZK_CONFIG_PATH =
  process.env.ZK_CONFIG_PATH ?? path.resolve(here, '..', '..', 'contract', 'src', 'managed', 'alphyn');
export const PRIVATE_STATE_ID = 'alphynPrivateState';
export const PRIVATE_STATE_STORE = 'alphyn-private-state';

export interface Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

export class PreprodConfig implements Config {
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preprod.midnight.network';
  proofServer = process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId('preprod');
  }
}

export class PreviewConfig implements Config {
  indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';
  constructor() {
    setNetworkId('preview');
  }
}

export function resolveConfig(name = process.env.MIDNIGHT_NETWORK ?? 'preprod'): Config {
  if (name === 'preview') return new PreviewConfig();
  return new PreprodConfig();
}

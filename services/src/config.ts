// Midnight network configuration. Endpoints verified against the official
// example-counter config (preprod/preview/standalone).
//
// NOTE on privacy: a browser DApp MUST use the endpoints the user's Lace wallet
// reports via getConfiguration() rather than hardcoding them. These constants
// are for the headless deploy/keeper CLIs only.

export type NetworkName = 'preprod' | 'preview' | 'standalone';

export interface NetworkConfig {
  networkId: string;   // value passed to setNetworkId()
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  preprod: {
    networkId: 'preprod',
    indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
  },
  preview: {
    networkId: 'preview',
    indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
  },
  standalone: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v3/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
  },
};

export function resolveNetwork(name = process.env.MIDNIGHT_NETWORK ?? 'preprod'): NetworkConfig {
  const cfg = NETWORKS[name as NetworkName];
  if (!cfg) throw new Error(`unknown MIDNIGHT_NETWORK '${name}' (preprod|preview|standalone)`);
  return cfg;
}

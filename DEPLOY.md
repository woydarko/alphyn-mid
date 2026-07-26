# Deploying Alphyn to Preprod

This captures the **verified** deploy pattern and endpoints so the live deploy is
a fill-in-the-blanks exercise. The version-sensitive wallet plumbing is pinned
and tested **live** against a funded wallet (the SDK is mid-migration, so an
untested blind stack would be fragile - we iterate against the real chain the way
the contract + tests were built).

## Prerequisites

- [x] Proof server running locally - `docker ps` shows `alphyn-proof-server` on `:6300` (healthy).
- [x] Contract compiled - `contract/src/managed/alphyn/` present (5 circuits + keys).
- [ ] **Funded Preprod wallet** - install **Lace**, switch to Preprod, fund from the faucet.
- [ ] A wallet **seed** for the headless deploy CLI (generate a throwaway; never a real-funds seed).

## Verified Preprod endpoints (`services/src/config.ts`)

| Service | URL |
|---|---|
| networkId | `preprod` |
| indexer | `https://indexer.preprod.midnight.network/api/v3/graphql` |
| indexer WS | `wss://indexer.preprod.midnight.network/api/v3/graphql/ws` |
| node (RPC) | `https://rpc.preprod.midnight.network` |
| proof server | `http://127.0.0.1:6300` (local) |

## Version alignment (critical)

Compiler **0.31.1** → generated code requires runtime **`@midnight-ntwrk/compact-runtime@0.16.0`**
(→ `@midnight-ntwrk/onchain-runtime-v3@^3`). The midnight-js deploy packages must
come from the generation that targets this runtime. Two generations exist in the
wild right now - pin one coherent set at deploy time and lock it:

- Older split packages: `@midnight-ntwrk/midnight-js-contracts@4.1.1` + sibling
  `midnight-js-*@4.1.1`, `@midnight-ntwrk/wallet@5.0.0`.
- Newer monopackage: `@midnight-ntwrk/midnight-js/*` subpaths + `wallet-sdk-facade`
  + `ledger-v8` + `compact-js` (example-counter `main`).

→ Determine which generation resolves cleanly against runtime 0.16 by installing +
`tsc` against the generated bindings, then lock it in `contract`/`services`.

## The real deploy pattern (from example-counter, verbatim shape)

```ts
// providers
const providers = {
  privateStateProvider: levelPrivateStateProvider({ privateStateStoreName, ... }),
  publicDataProvider:   indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
  zkConfigProvider:     new NodeZkConfigProvider(pathToManagedAlphyn),
  proofProvider:        httpClientProofProvider(cfg.proofServer, zkConfigProvider),
  walletProvider:       walletAndMidnightProvider,  // wraps the built wallet
  midnightProvider:     walletAndMidnightProvider,
};

// deploy
const alphyn = await deployContract(providers, {
  compiledContract:    alphynCompiledContract,     // from managed/alphyn bindings + witnesses
  privateStateId:      'alphynPrivateState',
  initialPrivateState,                             // { secretKey, allocation, nonce }
});
const contractAddress = alphyn.deployTxData.public.contractAddress;

// join later
const alphyn = await findDeployedContract(providers, {
  contractAddress, compiledContract: alphynCompiledContract,
  privateStateId: 'alphynPrivateState', initialPrivateState,
});

// call circuits
await alphyn.callTx.createVault(categoryOrdinal, assetCount);
await alphyn.callTx.rebalance(upBps, downBps);
```

The keeper (`services/src/keeper.ts`) plugs straight onto that `alphyn` handle -
it only needs `callTx.rebalance`, and its epoch logic is already built + tested.

## Steps at deploy time

1. Fund Lace on Preprod; export a throwaway seed → `KEEPER_WALLET_SEED` in `.env`.
2. Pin + lock the coherent midnight-js/wallet generation (see above).
3. Build wallet from seed, wait for sync, construct providers.
4. `deployContract(...)` → record `ALPHYN_CONTRACT_ADDRESS` in `.env` + README (L1 checklist: visible address).
5. `createVault` once to smoke-test; then `startKeeper(alphyn)` to run epochs.

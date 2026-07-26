// Build the compiled Alphyn contract for midnight-js (browser). Mirrors the
// example-bboard pattern: make(tag, Contract) → withWitnesses → withCompiledFileAssets.

import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as Gen from './managed/alphyn/contract/index.js';
import { witnesses, type AlphynPrivateState } from './witnesses';

export * from './managed/alphyn/contract/index.js';
export type { AlphynPrivateState } from './witnesses';

export const CompiledAlphynContract = CompiledContract.make<Gen.Contract<AlphynPrivateState>>(
  'Alphyn',
  Gen.Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./managed/alphyn'),
);

export type AlphynContract = Gen.Contract<AlphynPrivateState>;

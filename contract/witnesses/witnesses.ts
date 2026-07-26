// Witness implementations for alphyn.compact.
//
// In Midnight, `witness` declarations in Compact are implemented off-chain in
// TypeScript. Each witness receives the WitnessContext and returns a tuple:
// [possibly-updated private state, the value fed into the circuit].
//
// The private state below NEVER leaves the user's machine — it is held by the
// private-state provider. Only commitments/aggregates derived from it (via
// disclose() in the contract) ever reach the ledger.
//
// Types are aligned to the generated bindings in ../src/managed/alphyn/contract.

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../src/managed/alphyn/contract/index.js';

export type AlphynPrivateState = {
  /** Bytes<32> — the vault secret. Owning this == owning the vault. */
  readonly secretKey: Uint8Array;
  /** Vector<4, Uint<8>> → bigint[] — [USDC, ETH, BTC, ARB] weights, sum = 100. */
  readonly allocation: readonly [bigint, bigint, bigint, bigint];
  /** Bytes<32> — blinding factor for the allocation commitment. */
  readonly nonce: Uint8Array;
};

export const createAlphynPrivateState = (
  secretKey: Uint8Array,
  allocation: readonly [bigint, bigint, bigint, bigint],
  nonce: Uint8Array,
): AlphynPrivateState => ({ secretKey, allocation, nonce });

// The witness map. Keys MUST match the witness names in alphyn.compact, and the
// shape MUST satisfy the generated Witnesses<AlphynPrivateState> type.
export const witnesses: Witnesses<AlphynPrivateState> = {
  localSecretKey: (
    { privateState }: WitnessContext<Ledger, AlphynPrivateState>,
  ): [AlphynPrivateState, Uint8Array] => [privateState, privateState.secretKey],

  allocation: (
    { privateState }: WitnessContext<Ledger, AlphynPrivateState>,
  ): [AlphynPrivateState, bigint[]] => [privateState, [...privateState.allocation]],

  allocationNonce: (
    { privateState }: WitnessContext<Ledger, AlphynPrivateState>,
  ): [AlphynPrivateState, Uint8Array] => [privateState, privateState.nonce],
};

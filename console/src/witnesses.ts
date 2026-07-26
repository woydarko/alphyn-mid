// Witness implementations for alphyn.compact (browser). Names must match the
// witnesses declared in the contract. Private state never leaves the browser.

export type AlphynPrivateState = {
  readonly secretKey: Uint8Array;
  readonly allocation: readonly [bigint, bigint, bigint, bigint];
  readonly nonce: Uint8Array;
};

export const createAlphynPrivateState = (
  secretKey: Uint8Array,
  allocation: readonly [bigint, bigint, bigint, bigint],
  nonce: Uint8Array,
): AlphynPrivateState => ({ secretKey, allocation, nonce });

export const witnesses = {
  localSecretKey: ({ privateState }: { privateState: AlphynPrivateState }): [AlphynPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  allocation: ({ privateState }: { privateState: AlphynPrivateState }): [AlphynPrivateState, bigint[]] => [
    privateState,
    [...privateState.allocation],
  ],
  allocationNonce: ({ privateState }: { privateState: AlphynPrivateState }): [AlphynPrivateState, Uint8Array] => [
    privateState,
    privateState.nonce,
  ],
};

import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Category { conservative = 0, balanced = 1, aggressive = 2 }

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  allocation(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint[]];
  allocationNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createVault(context: __compactRuntime.CircuitContext<PS>,
              category_0: Category,
              assetCount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  rebalance(context: __compactRuntime.CircuitContext<PS>,
            upBps_0: bigint[],
            downBps_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           amount_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
  follow(context: __compactRuntime.CircuitContext<PS>,
         targetId_0: Uint8Array,
         pct_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  unfollow(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeVault(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createVault(context: __compactRuntime.CircuitContext<PS>,
              category_0: Category,
              assetCount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  rebalance(context: __compactRuntime.CircuitContext<PS>,
            upBps_0: bigint[],
            downBps_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           amount_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
  follow(context: __compactRuntime.CircuitContext<PS>,
         targetId_0: Uint8Array,
         pct_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  unfollow(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeVault(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveVaultId(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveVaultId(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createVault(context: __compactRuntime.CircuitContext<PS>,
              category_0: Category,
              assetCount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  rebalance(context: __compactRuntime.CircuitContext<PS>,
            upBps_0: bigint[],
            downBps_0: bigint[]): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           amount_0: bigint,
           recipient_0: { is_left: boolean,
                          left: { bytes: Uint8Array },
                          right: { bytes: Uint8Array }
                        }): __compactRuntime.CircuitResults<PS, []>;
  follow(context: __compactRuntime.CircuitContext<PS>,
         targetId_0: Uint8Array,
         pct_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  unfollow(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  closeVault(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  vaults: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { allocCommitment: Uint8Array,
                                 category: Category,
                                 assetCount: bigint,
                                 epochCount: bigint,
                                 gainScaled: bigint,
                                 lossScaled: bigint,
                                 followers: bigint,
                                 active: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { allocCommitment: Uint8Array,
  category: Category,
  assetCount: bigint,
  epochCount: bigint,
  gainScaled: bigint,
  lossScaled: bigint,
  followers: bigint,
  active: boolean
}]>
  };
  readonly vaultCount: bigint;
  follows: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  custody: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;

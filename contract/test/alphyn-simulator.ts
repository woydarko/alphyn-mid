// A local simulator for the Alphyn contract — runs the compiled circuits against
// an in-memory ledger, exactly as the Midnight runtime would, so tests exercise
// the REAL ZK logic (including the disclosure/commitment checks).
//
// Targets @midnight-ntwrk/compact-runtime 0.16.x (matches compiler 0.31.1).

import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  Category,
  pureCircuits,
} from '../src/managed/alphyn/contract/index.js';
import { witnesses, type AlphynPrivateState } from '../witnesses/witnesses.js';

const COIN_PK = '0'.repeat(64);

export class AlphynSimulator {
  readonly contract: Contract<AlphynPrivateState>;
  circuitContext: CircuitContext<AlphynPrivateState>;

  constructor(initial: AlphynPrivateState) {
    this.contract = new Contract<AlphynPrivateState>(witnesses);
    const c = this.contract.initialState(createConstructorContext(initial, COIN_PK));
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      c.currentZswapLocalState,
      c.currentContractState,
      c.currentPrivateState,
    );
  }

  /** Public ledger snapshot. */
  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /** Simulate a cheating prover by swapping the private allocation. */
  setAllocation(alloc: readonly [bigint, bigint, bigint, bigint]): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { ...this.circuitContext.currentPrivateState, allocation: alloc },
    };
  }

  /** Swap the whole private state — lets one ledger host several vaults (different secrets). */
  setPrivateState(ps: AlphynPrivateState): void {
    this.circuitContext = { ...this.circuitContext, currentPrivateState: ps };
  }

  createVault(category: Category, assetCount: bigint): void {
    this.circuitContext = this.contract.impureCircuits.createVault(
      this.circuitContext, category, assetCount,
    ).context;
  }

  rebalance(upBps: bigint[], downBps: bigint[]): void {
    this.circuitContext = this.contract.impureCircuits.rebalance(
      this.circuitContext, upBps, downBps,
    ).context;
  }

  follow(targetId: Uint8Array, pct: bigint): void {
    this.circuitContext = this.contract.impureCircuits.follow(
      this.circuitContext, targetId, pct,
    ).context;
  }

  closeVault(): void {
    this.circuitContext = this.contract.impureCircuits.closeVault(this.circuitContext).context;
  }

  unfollow(): void {
    this.circuitContext = this.contract.impureCircuits.unfollow(this.circuitContext).context;
  }

  /** This vault's public id (hash of the current secret). */
  vaultId(): Uint8Array {
    return pureCircuits.deriveVaultId(this.circuitContext.currentPrivateState.secretKey);
  }

  /** Derive a vault id from an arbitrary secret. */
  vaultIdFor(secret: Uint8Array): Uint8Array {
    return pureCircuits.deriveVaultId(secret);
  }
}

export const bytes32 = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

export const makeState = (
  fill: number,
  allocation: readonly [bigint, bigint, bigint, bigint],
): AlphynPrivateState => ({
  secretKey: bytes32(fill),
  allocation,
  nonce: bytes32(fill + 1),
});

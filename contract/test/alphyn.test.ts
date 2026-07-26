import { describe, it, expect } from 'vitest';
import { Category } from '../src/managed/alphyn/contract/index.js';
import { AlphynSimulator, makeState, bytes32 } from './alphyn-simulator.js';

// Asset order: [USDC, ETH, BTC, ARB]
const ALLOC = [10n, 60n, 20n, 10n] as const; // sums to 100

describe('Alphyn vault — privacy core', () => {
  it('createVault publishes a commitment + coarse labels, never the weights', () => {
    const sim = new AlphynSimulator(makeState(1, ALLOC));
    sim.createVault(Category.balanced, 3n);

    const l = sim.getLedger();
    expect(l.vaultCount).toBe(1n);

    const id = sim.vaultId();
    expect(l.vaults.member(id)).toBe(true);

    const v = l.vaults.lookup(id);
    expect(v.category).toBe(Category.balanced);
    expect(v.assetCount).toBe(3n);
    expect(v.epochCount).toBe(0n);
    expect(v.active).toBe(true);
    // commitment is present and non-zero; the raw allocation is nowhere on-chain.
    expect(v.allocCommitment.some((b) => b !== 0)).toBe(true);
  });

  it('rejects an allocation that does not sum to 100', () => {
    const sim = new AlphynSimulator(makeState(2, [10n, 10n, 10n, 10n]));
    expect(() => sim.createVault(Category.conservative, 4n)).toThrow();
  });

  it('rebalance records PnL weighted by the COMMITTED allocation', () => {
    const sim = new AlphynSimulator(makeState(3, ALLOC));
    sim.createVault(Category.balanced, 3n);

    // ETH (index 1) +3% => 300 bps. gainAdd = weight_ETH(60) * 300 = 18000.
    sim.rebalance([0n, 300n, 0n, 0n], [0n, 0n, 0n, 0n]);

    const v = sim.getLedger().vaults.lookup(sim.vaultId());
    expect(v.epochCount).toBe(1n);
    expect(v.gainScaled).toBe(18000n);
    expect(v.lossScaled).toBe(0n);
  });

  it('accumulates gain and loss across epochs (unsigned split)', () => {
    const sim = new AlphynSimulator(makeState(4, ALLOC));
    sim.createVault(Category.aggressive, 3n);

    sim.rebalance([0n, 300n, 0n, 0n], [0n, 0n, 0n, 0n]); // +18000 gain
    sim.rebalance([0n, 0n, 0n, 0n], [0n, 0n, 100n, 0n]); // BTC -1%: loss = 20*100 = 2000

    const v = sim.getLedger().vaults.lookup(sim.vaultId());
    expect(v.epochCount).toBe(2n);
    expect(v.gainScaled).toBe(18000n);
    expect(v.lossScaled).toBe(2000n);
  });

  it('ZK check REJECTS a rebalance whose allocation != the committed one', () => {
    const sim = new AlphynSimulator(makeState(5, ALLOC));
    sim.createVault(Category.balanced, 3n);

    // Cheating prover swaps to a different allocation after committing.
    sim.setAllocation([25n, 25n, 25n, 25n]);
    expect(() => sim.rebalance([0n, 300n, 0n, 0n], [0n, 0n, 0n, 0n])).toThrow();
  });

  it('follow links two vaults in one ledger and bumps the target follower count', () => {
    const sim = new AlphynSimulator(makeState(6, ALLOC)); // secret fill=6 -> target
    sim.createVault(Category.conservative, 2n);
    const targetId = sim.vaultIdFor(bytes32(6));

    // Second vault (secret fill=7) in the SAME ledger -> follower.
    const follower = makeState(7, ALLOC);
    sim.setPrivateState(follower);
    sim.createVault(Category.aggressive, 3n);
    const followerId = sim.vaultIdFor(bytes32(7));

    sim.follow(targetId, 50n);

    const l = sim.getLedger();
    expect(l.vaultCount).toBe(2n);
    expect(l.follows.member(followerId)).toBe(true);
    expect([...l.follows.lookup(followerId)]).toEqual([...targetId]);
    expect(l.vaults.lookup(targetId).followers).toBe(1n);
  });

  it('unfollow decrements the target follower count', () => {
    const sim = new AlphynSimulator(makeState(8, ALLOC));
    sim.createVault(Category.conservative, 2n);
    const targetId = sim.vaultIdFor(bytes32(8));

    sim.setPrivateState(makeState(9, ALLOC));
    sim.createVault(Category.aggressive, 3n);
    sim.follow(targetId, 40n);
    expect(sim.getLedger().vaults.lookup(targetId).followers).toBe(1n);

    sim.unfollow();
    const l = sim.getLedger();
    expect(l.vaults.lookup(targetId).followers).toBe(0n);
    expect(l.follows.member(sim.vaultIdFor(bytes32(9)))).toBe(false);
  });

  it('closeVault marks the vault inactive and blocks further rebalances', () => {
    const sim = new AlphynSimulator(makeState(10, ALLOC));
    sim.createVault(Category.balanced, 3n);
    sim.closeVault();

    expect(sim.getLedger().vaults.lookup(sim.vaultId()).active).toBe(false);
    expect(() => sim.rebalance([0n, 300n, 0n, 0n], [0n, 0n, 0n, 0n])).toThrow();
  });

  it('rejects creating a second vault from the same secret', () => {
    const sim = new AlphynSimulator(makeState(11, ALLOC));
    sim.createVault(Category.balanced, 3n);
    expect(() => sim.createVault(Category.balanced, 3n)).toThrow();
  });
});

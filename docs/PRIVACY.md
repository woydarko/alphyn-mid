# Alphyn Privacy Model

What a network observer (indexer, other users, the keeper, the app operator) can
and cannot learn. This is the core of the project - enforced by the Compact
compiler, not by convention.

## What an observer CAN see (public ledger)

| Observable | Where | What it reveals |
|---|---|---|
| A vault exists | `vaults[id]` | That some vault with id `id` was created. `id` is a hash of a secret - not linkable to a wallet identity by itself. |
| Allocation **commitment** | `vaults[id].allocCommitment` | A hash. Reveals **nothing** about the weights (preimage- and collision-resistant, salted with a private nonce). |
| Category label | `vaults[id].category` | conservative / balanced / aggressive - a coarse bucket the user consented to reveal. |
| Asset count | `vaults[id].assetCount` | How many assets (1-4). Not which, not the weights. |
| Epoch count | `vaults[id].epochCount` | How many rebalances have run. |
| Cumulative gain/loss (scaled) | `vaults[id].gainScaled` / `lossScaled` | Aggregate performance inputs → net PnL and Sharpe are derived off-chain. Not per-asset, not per-position. |
| Follower count | `vaults[id].followers` | How many vaults follow this one. |
| Follow links | `follows[follower] → target` | That one vault follows another. Not the follower's own strategy or size. |
| Total vaults | `vaultCount` | Protocol-wide liveness. |

## What an observer CANNOT see (private witness)

| Hidden | Why it stays hidden |
|---|---|
| **The allocation weights** | Live only as `allocation()` witness data on the user's machine. Only their commitment is public. Never wrapped in `disclose()` → the compiler *guarantees* they cannot reach the ledger. |
| The vault secret key | `localSecretKey()` witness - owning it is owning the vault. Only its hash (the vaultId) is public. |
| The commitment nonce | `allocationNonce()` witness - salts the commitment so it can't be brute-forced from the small space of possible allocations. |
| Exact balance / principal | Notional balance is private state; the ledger holds only aggregate scaled PnL. |
| Per-asset positions or PnL | Only the summed `gainScaled`/`lossScaled` are disclosed, never the per-asset breakdown. |
| A followed vault's strategy | `follow` never reads the target's allocation - it only records a public link. |

## The zero-knowledge guarantee

`createVault` publishes `commit(allocation, nonce)`. Every `rebalance` **recomputes
that commitment from the private witness and asserts it equals the stored one**:

```compact
const recomputed = commitAllocation(allocation(), allocationNonce());
assert(recomputed == v.allocCommitment, "allocation does not match commitment");
```

This proves - in zero knowledge - that the disclosed aggregate PnL was computed
from the **same allocation the vault originally committed to**, without ever
revealing that allocation. A server could lie about this; a ZK circuit cannot.
This replaces the original design's iExec TEE attestation (trust the enclave) with
a mathematical proof (trust nothing).

**Tested:** `contract/test/alphyn.test.ts` includes a case where a prover swaps to
a different allocation post-commit - the circuit **rejects** it.

## Deliberate disclosures (the only three)

`disclose()` appears in exactly three places, all on non-sensitive aggregates:
1. the vaultId (a hash of the secret - the intended public handle),
2. the allocation **commitment** (a hash),
3. per-epoch `gainAdd` / `lossAdd` sums,
plus the coarse `category` / `assetCount` labels the user opts to reveal.

The raw allocation weights are never disclosed, so the compiler's information-flow
analysis makes leaking them a compile error - the guarantee is structural.

## What is trusted (honest limitations)

- **Price feed**: `upBps`/`downBps` come from an off-chain oracle (CoinGecko/Hermes).
  Like any oracle (the EVM original used Pyth), the prices themselves are trusted
  inputs. The ZK proof covers that PnL was weighted by the *committed allocation* -
  not that the prices are true.
- **Notional model**: no real DEX exists on Midnight, so positions are notional;
  there is no on-chain custody/settlement of the underlying assets.

# Alphyn Contract (Compact / Midnight)

The `alphyn.compact` contract is the privacy core of the vault. This document
explains **what is public vs. private** - the required "public state vs. private
witness" section for the hackathon.

## Public ledger state (visible to everyone)

| Field | Type | What it reveals |
|---|---|---|
| `vaults[id].allocCommitment` | `Bytes<32>` | A **commitment** (hash) to the allocation. Reveals *nothing* about the weights - only lets the chain check future rebalances used the same strategy. |
| `vaults[id].category` | `Category` | Coarse label: conservative / balanced / aggressive. |
| `vaults[id].assetCount` | `Uint<8>` | How many assets (1-4). Not the weights. |
| `vaults[id].epochCount` | `Uint<32>` | Number of rebalances executed. |
| `vaults[id].gainScaled` / `lossScaled` | `Uint<64>` | Cumulative **aggregate** PnL inputs. Net PnL & Sharpe are derived off-chain. Split into two unsigned accumulators because Compact has no signed integers. |
| `vaults[id].followers` | `Uint<32>` | How many vaults follow this one. |
| `vaultCount` | `Counter` | Total vaults created (liveness). |
| `follows[followerId]` | `Bytes<32>` | Who follows whom (the link is public; the follower's own weights are not). |

## Private witness state (never leaves the user's machine)

| Witness | Type | Why it's private |
|---|---|---|
| `localSecretKey()` | `Bytes<32>` | The vault secret. Owning it = owning the vault; also derives the public `vaultId`. |
| `allocation()` | `Vector<4, Uint<8>>` | **The strategy** - per-asset weights. This is the whole point: it is never disclosed. |
| `allocationNonce()` | `Bytes<32>` | Blinding factor so the public commitment can't be brute-forced. |

## The ZK guarantee

`createVault` publishes only `commit(allocation, nonce)`. Every `rebalance`
recomputes that commitment from the private witness and `assert`s it equals the
stored one - **proving the recorded PnL followed the committed allocation**,
without ever revealing the allocation. This replaces the original design's iExec
TEE attestation with a zero-knowledge proof.

`disclose()` is used in exactly three places, all on *aggregates*: the allocation
commitment (a hash), and the per-epoch `gainAdd` / `lossAdd` sums. The raw
weights are never wrapped in `disclose()`, so the compiler guarantees they can't
leak.

## Notional model

Midnight has no on-chain DEX, so the vault is **notional/paper**: `upBps` /
`downBps` are public oracle price-returns fed into `rebalance`; there are no real
token swaps. PnL is `Σ_i weight_i · returnBps_i`, accumulated on-chain, divided
by 100 off-chain for display.

## Build

```bash
npm install
npm run compile     # compact compile src/alphyn.compact src/managed/alphyn
```

Requires the Midnight toolchain (Compact compiler + proof server). See the root
README for setup. Compilation emits `src/managed/alphyn/` (circuits + keys +
TypeScript contract bindings).

> **Status:** compiles clean with **compiler 0.31.1** (exit 0). `managed/alphyn/`
> contains all 5 circuits (`createVault`, `rebalance`, `follow`, `unfollow`,
> `closeVault`) as `.zkir` + prover/verifier keys + TS bindings. The two earlier
> `VERIFY@compile:` questions are resolved: `persistentCommit<T>(value, nonce)`
> and `Map.member` are both correct.

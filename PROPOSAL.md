# Product Proposal

## What is the product, and who uses it?

Alphyn is a portfolio vault where the strategy is private. A user answers a short risk questionnaire, an AI turns that into an asset allocation, and the vault tracks that allocation over time. The catch is that the allocation is never public. It stays as private witness data, and the chain only ever holds a commitment to it plus aggregate performance.

Two kinds of people use it. The first is someone who wants a personalized strategy but does not want it copied or front-run the moment it goes on-chain. The second is someone who wants to follow a good vault based on its track record, without needing to see, or being able to see, the recipe behind it.

## Why Midnight specifically?

On a transparent chain this product cannot exist. The whole point is that the allocation is hidden while the vault's behavior is still verifiable. Those two things pull in opposite directions on a normal blockchain: to prove a vault followed its strategy you would have to reveal the strategy.

Midnight resolves that with zero-knowledge circuits and private witness state. The allocation lives off-chain as a witness. The contract commits to it once, and every rebalance proves the reported PnL was computed from that same committed allocation. The proof convinces anyone the vault played fair, and it reveals nothing about the weights. `disclose()` makes the privacy boundary explicit and the compiler enforces it, so a leak of the sensitive data would be a compile error rather than a bug you hope you caught.

A trusted execution environment could hide the strategy too, and the earlier version of this project did exactly that. But that asks the user to trust the enclave and its operator. The zero-knowledge version asks them to trust math instead.

## Data Model

| Data Point | Type | Disclosed To |
|------------|------|--------------|
| Allocation weights | Private witness | No one |
| Vault secret key | Private witness | No one |
| Commitment nonce | Private witness | No one |
| Balance / principal | Private state | Only the owner |
| Allocation commitment (hash) | Public ledger | Everyone |
| Category (conservative / balanced / aggressive) | Public ledger | Everyone |
| Asset count | Public ledger | Everyone |
| Epoch count | Public ledger | Everyone |
| Cumulative gain / loss (aggregate) | Public ledger | Everyone |
| Follower count and follow links | Public ledger | Everyone |

## Mainnet Feasibility

The privacy core is done and works on a live testnet, so the hard part is behind us. What is left before Mainnet is mostly product surface and honesty about scope.

The one real design constraint is that Midnight does not have an on-chain DEX yet, so the vault is notional. It tracks positions against an off-chain price feed and proves the math, rather than custodying and swapping real assets. That is the right shape for now and it is enough to prove the idea. Real settlement waits on DEX infrastructure landing on Midnight.

Reaching Mainnet by the end of the program is realistic for the notional version: same contract, same circuits, a network switch and a redeploy. Turning it into something that manages real value is a larger step that depends on the ecosystem, not on this codebase.

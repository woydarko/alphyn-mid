# Path A — Real Custody + Oracle-Priced Basket Swaps

Plan to evolve Alphyn from a **notional** vault (paper capital, simulated PnL) to a
vault that **custodies real value on Midnight** and executes **real, deterministic
swaps** across the basket — while keeping the ZK privacy thesis intact.

Status: **Phase 1 live**. Real tNIGHT deposit verified on-chain via browser + 1AM on
Preprod — contract `66850e6c6ea19c2a9c450c4b55f893a7dfafca2f272b0ddec960dda516608e34`,
deposit ContractCall in block 2261180 (tx
`58ee057f503bdc8a819c35c967607905cdc154b78ad56b4156437e6c31a8d582`). Phases 2-3
(signed oracle, internal basket swaps) are next.

---

## 1. How Midnight actually works (the parts that constrain us)

**Zswap** (Midnight's shielded token protocol):
- Every unit of value is a **coin**: `{ tokenType: Bytes<32>, value, nonce }`.
- A transaction carries **offers** of `inputs` (coins spent) and `outputs` (coins
  created); an offer must **balance to zero per token type** (inputs = outputs).
- **Contracts can own coins**: contract-owned inputs (spend from contract) and
  contract-owned outputs (send to contract). So a contract can hold custody.
- **Custom token types** exist and can be **minted**; DUST is the fee token, NIGHT
  is the native asset.
- Amounts and owners are hidden (privacy is native).

**Compact** (the contract language) offers two ways to represent balances:
1. **Ledger-accounted** — a `Map<_, Uint>` balance book inside contract state.
   Deposits/swaps are arithmetic on that book. Simple, deterministic, fully
   self-contained; the "tokens" are internal accounting units, not withdrawable
   Zswap coins.
2. **Real Zswap coins** — the contract receives/sends actual coins and can mint
   custom token types. Real, transferable custody; more plumbing; any swap needs a
   counterparty or mint/burn to keep offers balanced.

**Hard constraint:** ADA, DJED, SNEK are **Cardano-native** — they do **not exist
on Midnight**. Only NIGHT is native. Emerging Midnight DEXs (GalaxySwap, CSWAP,
Ascend) do not have Preprod liquidity for this basket. So "swap into real ADA on
Midnight" is not possible today without a bridge.

**Conclusion:** the realistic "real" design custodies a **real base token (tNIGHT)**
and represents the 4-asset basket as **oracle-priced internal holdings**. Real value
enters and leaves; allocation is tracked and rebalanced at oracle prices. This is an
honest **index-vault** model — not a claim of holding real ADA/SNEK.

---

## 2. Target design (hybrid custody)

- **Real value in/out:** users deposit and withdraw **real tNIGHT** as Zswap coins
  the contract custodies (contract-owned coins).
- **Internal basket:** the deposited value is split across the 4 basket slots as
  ledger-accounted balances, valued at **oracle prices**.
- **Swap = internal rebalance:** moving value between slots at the oracle rate — no
  external DEX or liquidity needed, deterministic, provable.
- **Withdraw:** value the current basket at oracle prices; return real tNIGHT coins.

Privacy preserved exactly as today: per-asset **weights stay private** (witness +
commitment); only aggregates + commitment are public; every rebalance still proves
it followed the committed allocation.

---

## 3. Components to build

### 3.1 Price oracle (new service, extends `services/priceFeed.ts`)
- Fetch CoinGecko prices for the basket (`midnight-3`, `cardano`, `djed`, `snek`).
- Emit a **signed price vector** `{ prices[4], timestamp, sig }` with an operator key.
- The contract verifies the signature + **freshness window** (block-time bound) and
  uses the prices as public input. Trusted-operator oracle for now; note the
  centralization and a path to decentralize (multiple signers / on-chain feed).

### 3.2 Contract circuits (`contract/src/alphyn.compact` — recompile + redeploy)
- `deposit(baseCoin)` — receive a real tNIGHT coin into contract custody; credit the
  vault's base value; split across basket slots per the private committed weights at
  current oracle prices.
- `rebalance(prices, sig)` — verify oracle; recompute target basket from committed
  weights + new prices; move internal slot balances at the oracle rate; keep proving
  the allocation matches the private commitment (existing ZK property).
- `withdraw(amount)` — value current basket at oracle prices; send real tNIGHT coins
  back to the owner; debit balances.
- Preserve the existing public surface: category, epochCount, gain/loss aggregates,
  followers, allocCommitment.

### 3.3 Coin custody plumbing
Verified against the released Compact stdlib. The real primitives are:
- **Receive a deposit:** `receiveUnshielded` (NIGHT is the native *unshielded* token)
  or `receiveShielded` (for amount privacy). Types: `ShieldedCoinInfo`,
  `QualifiedShieldedCoinInfo`, `ShieldedSendResult`.
- **Send/withdraw:** `sendUnshielded` / `sendShielded` / `sendImmediateShielded`.
- **Read custody balance:** `unshieldedBalance` (+ `unshieldedBalanceLt/Gte`).
- **Identity / token:** `ownPublicKey`, `tokenType`, `nativeToken`.
- **Consolidate coins:** `mergeCoin` / `mergeCoinImmediate`.
- **Mint (Path A+ only):** `mintShieldedToken` / `mintUnshieldedToken`; burn via
  `shieldedBurnAddress`. Low-level: `createZswapInput` / `createZswapOutput`.
- Base token: **tNIGHT** (native, liquid on Preprod). NIGHT is unshielded, so custody
  uses the `*Unshielded` family; if amount privacy on deposits matters, shield first
  and use the `*Shielded` family instead.

### 3.4 Valuation & PnL
- Replace notional PnL with **real holdings valued at oracle prices** (still relative
  returns, but over the actually-held basket). Off-chain analytics (`services/`) keep
  computing net PnL / Sharpe / drawdown from the real series.

### 3.5 Frontend / services
- `console/src/pages/Deposit.tsx` — real deposit (sign + send tNIGHT coin); remove the
  "notional" banner; show real custodied value.
- Withdraw flow — real redemption in tNIGHT.
- Wire the oracle service + signing into the keeper/bridge and the browser rebalance.

---

## 4. Phasing (each phase is shippable + meaningful commits)

1. **Real base custody** — deposit/withdraw real tNIGHT in/out of the contract; no
   swap yet. Replaces notional principal with real custody. (Smallest real win.)
2. **Signed oracle** — price service + signing + on-chain verification + freshness.
3. **Internal basket swaps** — allocate + rebalance across slots at oracle prices;
   real-holdings PnL; remove the notional path.
4. **(Optional) Path A+** — mint 4 real, transferable Zswap token types + a minimal
   oracle-priced AMM with operator liquidity, so basket units become withdrawable
   tokens. Much larger; needs liquidity; do only if the demo needs true tokenization.

---

## 5. Risks & open questions

- **Compact coin-custody API** — verified (see 3.3); still confirm exact signatures
  and the shielded-vs-unshielded choice for NIGHT during Phase 1 spike.
- **Oracle trust + freshness** — operator-signed prices; dust/coin txs also face the
  validity-window rules (cf. error 171). Keep the oracle timestamp fresh.
- **Recompile + redeploy** — new circuits change the verifier key → a new Preprod
  contract address; update docs + the console default.
- **Testing** — extend `contract/` vitest for deposit/swap/withdraw invariants
  (conservation of value, allocation-commitment consistency, withdraw ≤ holdings).
- **Honesty in copy** — the basket is oracle-priced index exposure, not custody of
  real ADA/SNEK; say so in the UI and docs.

---

## 6. Decision needed before build

- Confirm **base token = tNIGHT** (vs tDUST).
- Confirm **hybrid custody** (this plan) vs the larger **Path A+** tokenized-AMM.
- Confirm the **oracle trust model** is acceptable for the submission (operator-signed,
  documented as centralized-for-now).

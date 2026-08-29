# Keeper Plan — one operator runs epochs for every vault

Goal: stop making each user run their own epochs from the browser. Run a single
**server-side keeper** that rebalances every active vault on a fixed cadence,
funded by one operator wallet — no page open, no per-epoch wallet approval.

Status: **planning**. The bridge already exists (`deploy/src/bridge.ts`) and
implements the keeper loop; this plan migrates it to Preprod and wires it to the
current (browser, real-custody) vaults.

---

## 1. Why a keeper must hold the allocation (the one trade-off)

`rebalance` proves the recorded PnL used the vault's **committed allocation**. That
proof needs the allocation **witness** (weights + nonce) and the vault secret. So
whoever runs epochs must hold those. There is no way around it — an automated
epoch requires the private allocation.

- **On-chain stays private**: only the commitment + aggregate PnL are ever public.
  Other users, the indexer — none learn the weights.
- **Who learns them**: the keeper (the user's own operator). That is the accepted
  trade-off for hands-off automation, and it mirrors the original Alphyn keeper.
- Custody is unaffected — the keeper only runs `rebalance` (PnL), it never touches
  the user's tNIGHT. Deposits/withdrawals stay with the user in the browser.

The keeper submits `rebalance` from the **operator wallet**; the circuit derives
the vaultId from the secret witness (no `msg.sender`), so any wallet holding the
secret can run a vault's epoch. The operator only pays dust/fees.

---

## 2. Architecture (keeper = rebalance-only service for browser vaults)

```
User (browser)                     Keeper (server)                Preprod
  mint vault (real custody) ──────────────────────────────────►  createVault
  register {vaultId, secret, nonce,
            allocation, contract} ──►  bridge-vaults.json
  deposit / withdraw tNIGHT ───────────────────────────────────►  custody
                                     keeper loop (every N s):
                                       for each active vault:
                                         fetchOracle (CoinGecko)
                                         rebalance(up,down) ─────►  PnL aggregates
                                     (operator wallet pays dust)
  vault page just reflects PnL  ◄────  /leaderboard, /vault
```

- The vault lives on the **console's contract** (real custody). The keeper **joins
  that contract** with the registered secret/allocation and runs `rebalance`.
- One operator wallet, serialized txs (the bridge already serializes keeper + API
  ops over a single wallet).

---

## 3. Work required

### 3.1 Migrate the bridge to the current stack (mirrors the console fixes)
- Bump `deploy` deps: `ledger-v8` 8.0.3 → **8.1.0**, `compact-runtime` 0.15 →
  **0.16**, `midnight-js*` 4.0.4 → **4.1.1** — the same alignment that fixed
  error 170 in the console.
- Recompile the deploy contract with compiler **0.31.1** so it matches the
  console's contract (same circuits, same verifier keys), or have the keeper
  simply **join the console's deployed contract** instead of deploying its own.
- Point config at **Preprod** (already supported in `deploy/src/config.ts`).

### 3.2 Add a register endpoint (vaults already exist on-chain)
- `POST /register` — the console sends `{ vaultId, secretHex, nonceHex,
  allocation, contractAddress, epochDurationSeconds }` after a successful mint.
- The keeper stores it in `bridge-vaults.json` and starts including it in the loop.
- (The existing `/mint` stays for the fully-bridge-managed flow; `/register` is the
  lighter "browser mints, keeper only runs epochs" path.)

### 3.3 Keeper loop per registered vault
- Already present (`keeperTick`). Ensure it **joins the vault's own
  `contractAddress`** (not a single global one) and runs `rebalance`.
- Keep `withDustRetry` (waits for dust regeneration) and the oracle bounds.

### 3.4 Console integration
- After mint, `POST /register` to the keeper (best-effort; vault still works if the
  keeper is down).
- When `VITE_BRIDGE_URL` / the keeper is reachable, the vault page shows
  "Keeper is running epochs automatically" and drops the manual Run/Auto-run UI.
- Set `VITE_BRIDGE_URL` to the hosted keeper for the deployed console.

### 3.5 Operator wallet (user funds this)
- One throwaway Preprod wallet; its address derives from the seed in
  `deploy/.env`. **You fund it with tNIGHT** (for dust generation → fees).
- It needs enough NIGHT registered for dust to cover one rebalance per vault per
  cadence. Modest amount for a demo.

---

## 4. The hosting constraint (important)

`deploy/src/wallet.ts` does a full wallet sync that **OOMs on the 16GB local
machine** (Preprod's shielded history is large). So the keeper realistically runs
on a **VM/server with more RAM** (or a box where the sync fits), not the local
machine. It's a long-running background service anyway — a small VPS is the right
home. The console points at it via `VITE_BRIDGE_URL`.

---

## 5. Privacy / trust summary (for the docs + video)

- Public on-chain: commitment + aggregate PnL only. Unchanged.
- Keeper knows: each registered vault's allocation + secret (required to prove).
- Custody: stays with the user (browser real deposit/withdraw); keeper never holds it.
- This is the user's own operator, funded by the user — the same shape as the
  original Alphyn keeper, now on Preprod with real custody alongside.

---

## 6. Decisions before build

1. **Register flow** (keeper runs epochs for browser vaults) vs **full-bridge mint**
   (keeper also creates + could custody). Recommend register — keeps real custody
   with the user.
2. **Keeper contract**: join the console's contract (recommended) vs deploy its own.
3. **Host**: which VM/box runs the keeper (local OOMs). You fund the operator wallet
   regardless.

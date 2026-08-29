# Feedback Loop

How Alphyn collects user feedback, decides what to change, and keeps docs in sync. This is a living document — updated every cycle of the Level 5 loop.

## How we collect feedback

| Channel | Link | What it captures |
|---------|------|------------------|
| In-app feedback | _(add link / button)_ | Bugs, confusion, feature asks during onboarding |
| Feedback form | _(Google Form / Tally link)_ | Structured survey: wallet address, task success, NPS, free text |
| X / DMs | [@AlphynVault](https://x.com/AlphynVault) | Public reactions, informal reports |
| Onboarding calls | _(notes doc link)_ | Watched sessions with the first users |

Each report is logged in the raw log below with: date, wallet (if given), channel, verbatim, and a tag.

## Prioritization

Every item scored on two axes, then bucketed:

- **Impact** — how many users hit it / how badly it blocks the core flow (mint → epoch → leaderboard).
- **Effort** — rough dev cost.

Buckets: `now` (high impact / low effort), `next` (high impact / high effort), `later` (low impact), `wontfix` (out of scope) — with a one-line reason.

## Raw feedback log

Cycle 1 opened with **dogfooding on Preprod** (the builder driving the live app
end-to-end through 1AM) before external onboarding. That surfaced the items below;
external-user rows get appended here once the hosted demo is out.

| # | Date | Source | Channel | Feedback | Tag | Priority | Status |
|---|------|--------|---------|----------|-----|----------|--------|
| 1 | 2026-08-28 | dogfood | live test | "Deposit input is in base units (STAR) — I have 2000 tNIGHT in my wallet but the box wants a huge number; confusing." | ux | now | ✅ Resolved |
| 2 | 2026-08-28 | dogfood | live test | "The deposit form doesn't show my wallet balance — I'm guessing amounts." | ux | now | ✅ Resolved |
| 3 | 2026-08-28 | dogfood | live test | "Having to sign a separate 'Run epoch' every time is tedious — can it run when I deposit?" | feature | now | ✅ Resolved |
| 4 | 2026-08-28 | dogfood | live test | "A deposit failed and I couldn't tell why / whether it went through — no tx feedback." | reliability | now | ✅ Resolved |
| 5 | 2026-08-28 | dogfood | live test | "The orange theme doesn't feel like Midnight; make it dark/purple." | design | now | ✅ Resolved |
| 6 | 2026-08-28 | dogfood | live test | "Dashboard looks demo-y — too much text, inconsistent cards, over-rounded." | design | now | ✅ Resolved |
| 7 | 2026-08-28 | dogfood | live test | "The quiz pre-selects some assets; the option animation feels stiff." | ux | now | ✅ Resolved |
| 8 | 2026-08-28 | dogfood | live test | "PnL didn't move — is the oracle even connected?" | reliability | now | ✅ Resolved |
| 9 | 2026-08-28 | dogfood | live test | "Vault detail still shows a 'Run epoch' button even though deposit runs it — and card typography is messy." | ux | now | ✅ Resolved |
| 10 | 2026-08-28 | dogfood | live test | "The allocation shows '58 DJED' — did it really swap my tNIGHT into DJED?" | clarity | now | ✅ Resolved |

<!-- keep appending; do not delete rows, mark them Resolved -->

## What we changed (feedback → commit)

Traceability: each change links the feedback item to the commit that shipped it.

| Feedback # | Change | Commit | Docs updated |
|------------|--------|--------|--------------|
| 1 | Denominate amounts in whole tNIGHT (6 decimals), not STAR base units | `57ade27` | README |
| 2 | Show wallet tNIGHT balance + MAX on the deposit form | `628b452` | — |
| 3 | `depositAndRebalance` circuit — a deposit runs one epoch in the same tx | `2968f53` | README |
| 4 | Tx toasts (success/error) with the hash + explorer link; guard amounts and surface on-chain reverts | `ed635be`, `0998614` | — |
| 5 | Full dark Midnight theme with dark-purple accent | `bfac3c0` | — |
| 6 | Tighter dashboard — trimmed copy, one consistent card style, less rounding, hover interaction | `ed635be` | — |
| 7 | Remove quiz preselect; smoother option animations | `bfac3c0` | — |
| 8 | Oracle retries + surfaces a clear error instead of a silent flat epoch | `bfac3c0` | — |
| 9 | Drop the redundant Run epoch button; normalize vault-detail card typography | `097c642`, `f6518ab` | — |
| 10 | Clarify the basket is an oracle-priced target, not a real swap (custody is real tNIGHT) | `f16b6f6` | README, PRIVACY, PROPOSAL |

## Docs kept in sync

When a change alters behavior, the matching doc is updated in the same cycle:

- [README.md](../README.md) — overview, setup, run
- [docs/USAGE.md](USAGE.md) — step-by-step flow
- [docs/PRIVACY.md](PRIVACY.md) — privacy model
- [docs/PREPROD-USERS.md](PREPROD-USERS.md) — the 50-user wallet list

## Cycle summary

Short retro each loop: what we heard, what we shipped, what's still open.

- **Cycle 1 (started 2026-08-28):** Heard — the real-money flow was confusing (base units, no balance, tedious epoch signing, no tx feedback) and the UI read as a demo (orange, cluttered cards, stiff quiz). Shipped — whole-tNIGHT denomination + MAX, deposit-runs-epoch, tx toasts with hashes, a dark Midnight theme, a tighter dashboard, and honest allocation wording. Still open — external-user feedback (pending the hosted demo), and real on-chain basket swaps (see [REAL-CUSTODY-PLAN.md](REAL-CUSTODY-PLAN.md)).

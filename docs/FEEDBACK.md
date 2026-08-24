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

| # | Date | Wallet (short) | Channel | Feedback | Tag | Priority |
|---|------|----------------|---------|----------|-----|----------|
| 1 | | | | | | |
| 2 | | | | | | |

<!-- keep appending; do not delete rows, mark them Resolved -->

## What we changed (feedback → commit)

Traceability: each change links the feedback item to the commit that shipped it.

| Feedback # | Change | Commit | Docs updated |
|------------|--------|--------|--------------|
| | | | |

## Docs kept in sync

When a change alters behavior, the matching doc is updated in the same cycle:

- [README.md](../README.md) — overview, setup, run
- [docs/USAGE.md](USAGE.md) — step-by-step flow
- [docs/PRIVACY.md](PRIVACY.md) — privacy model
- [docs/PREPROD-USERS.md](PREPROD-USERS.md) — the 50-user wallet list

## Cycle summary

Short retro each loop: what we heard, what we shipped, what's still open.

- **Cycle 1 (started ____):** _(fill in)_

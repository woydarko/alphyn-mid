# How to use Alphyn

This walks you through running a vault end to end. No blockchain experience needed beyond installing a wallet.

## What you need

- Google Chrome (or another Chromium browser)
- A Midnight wallet extension, either 1AM or Lace, set to the Preview network
- Some test funds. Paste your wallet's unshielded address into the Preview faucet at https://faucet.preview.midnight.network/ and request tokens. Give the wallet a minute or two to sync.
- The proof server running locally. If you cloned the repo, start it with `docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v`.

## Step by step

1. Open the landing site at `http://localhost:3000`. Click **Connect & Launch**, approve the wallet prompt, and you land in the app at `/app`.
2. The app drops you straight into the strategy questionnaire: risk tolerance, time horizon, preferred assets, target APY, max drawdown, and an optional name and notes. From those answers the local engine builds an allocation across USDC, ETH, BTC, and ARB plus rebalance parameters. The weights are computed in your browser and never leave it.
3. Review the preview: category, allocation bars, and parameters. Click **Mint this strategy**. The app deploys or joins the vault contract and commits a hash of your allocation on-chain. The weights themselves stay on your machine, encrypted at rest with a key derived from your wallet.
4. You arrive on your vault page. It shows notional NAV, cumulative PnL, the performance chart, and your private allocation. Click **Run epoch** to rebalance once, or tick **Auto-run** to fire an epoch on your strategy's cadence while the page stays open. Each epoch generates a real zero-knowledge proof that the PnL followed your committed allocation.
5. **Deposit** and **Withdraw** set your notional paper capital. No real tokens move; Midnight has no DEX yet, so the vault sizes PnL against paper capital and proves the math.
6. The **Dashboard** lists all your vaults with aggregate stats. **New Strategy** mints another vault into the same contract.
7. The **Leaderboard** ranks every vault on the shared ledger by public aggregates only. Click **Follow** on someone else's vault, pick which of your vaults follows and at what percent. Neither side's strategy is revealed.
8. **Settings** lets you rename a vault locally and close it on-chain. Closing asks you to type CONFIRM because it cannot be undone.

Each action takes a moment because a real proof is being generated on the proof server. That is normal.

## What gets proved, and what stays private

When you create a vault, the chain stores a commitment to your allocation, which is just a hash. It tells nobody what your weights are.

When you rebalance, the app proves two things at once. First, that the PnL it reports came from your committed allocation and not some made-up number. Second, that it did this without disclosing the allocation. A regular server could lie about following your strategy. A zero-knowledge circuit cannot.

What everyone can see: your category, how many assets you hold, how many epochs you have run, your aggregate gain and loss, and who follows whom. What nobody can see: the actual weights, your balance, and any per-asset breakdown.

## Troubleshooting

**"No compatible wallet found."** The extension is not installed, or it is not on Preview. Install 1AM or Lace, switch the network to Preview, and refresh.

**Connect works but nothing happens on Create or Rebalance.** Check the proof server is running on port 6300. Without it, proofs cannot be generated.

**Balance shows zero.** The faucet has not funded your address yet, or it went to a different address. Copy the exact address the app or wallet shows, request from the faucet again, and give it a minute to sync.

**The wallet takes a long time to sync.** A fresh wallet scans chain history the first time. On Preview this is quick, usually a minute or two. If it stalls near the end it is finishing the dust portion; leave the tab open.

**A transaction fails during proving.** Your wallet needs a small amount of dust to pay fees, which is generated from your test funds over a few blocks. If you just funded the wallet, wait a moment and try again.

# How to use Alphyn

This walks you through running a vault end to end. No blockchain experience needed beyond installing a wallet.

## What you need

- Google Chrome (or another Chromium browser)
- A Midnight wallet extension, either 1AM or Lace, set to the Preview network
- Some test funds. Paste your wallet's unshielded address into the Preview faucet at https://faucet.preview.midnight.network/ and request tokens. Give the wallet a minute or two to sync.
- The proof server running locally. If you cloned the repo, start it with `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v`.

## Step by step

1. Open the app. In development that is `http://localhost:5173`. The landing site has a "Launch App" button that opens it too.
2. Click **Connect Wallet** and approve the request in your wallet popup. Your address shows up once it connects.
3. The deployed contract address is already filled in, so you can jump straight to using it. If you would rather stand up your own, click **Deploy new contract** instead and wait for the address to appear.
4. Pick a **risk level** with the slider. This is the only input that shapes your allocation. The weights are worked out locally and never leave your browser.
5. Click **Create my vault**. Your wallet will ask you to approve. Behind the scenes this commits a hash of your allocation to the chain. The weights themselves stay on your machine.
6. Click **Rebalance** to run one epoch. This is where the zero-knowledge proof happens: the app proves your PnL was calculated from the allocation you committed to, without revealing it. Approve in your wallet and wait for the transaction.
7. Click **Refresh** under the leaderboard. You will see your vault with its category, epoch count, and net PnL. You will not see the weights, because they were never published.
8. To follow another vault, paste its id into the follow box and click **Follow**. That records a public link between the two vaults. Neither strategy is exposed.

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

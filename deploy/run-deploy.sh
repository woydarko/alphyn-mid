#!/usr/bin/env bash
set -e
source "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null
SRC=/mnt/c/Users/nabil/Documents/Alpuzz/alphyn-midnight
DEST=$HOME/alphyn-deploy

echo "=== sync src + compiled contract to native FS ==="
cp -r "$SRC/deploy/src" "$DEST/"
rm -rf "$DEST/managed"; mkdir -p "$DEST/managed"
cp -r "$SRC/contract/src/managed/alphyn" "$DEST/managed/alphyn"

# .env with native ZK asset path
grep -v '^ZK_CONFIG_PATH=' "$SRC/deploy/.env" > "$DEST/.env"
echo "ZK_CONFIG_PATH=$DEST/managed/alphyn" >> "$DEST/.env"

cd "$DEST"
export NODE_OPTIONS="--max-old-space-size=8192"
echo "=== node $(node -v) heap=8G ; deploying (cold full-chain sync — may take a few hours) ==="
timeout 18000 npx tsx src/deploy.ts 2>&1 | tee /tmp/alphyn-deploy.log | tail -90

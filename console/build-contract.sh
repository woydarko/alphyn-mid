#!/usr/bin/env bash
set -e
export PATH="$HOME/.local/bin:$PATH"
CROOT=/mnt/c/Users/nabil/Documents/Alpuzz/alphyn-midnight
C="$CROOT/console"
echo "=== compile contract @ 0.16 into console ==="
compact update 0.31.1 2>&1 | tail -1
rm -rf "$C/src/managed"
compact compile "$CROOT/contract/src/alphyn.compact" "$C/src/managed/alphyn" 2>&1 | tail -1
grep runtime-version "$C/src/managed/alphyn/compiler/contract-info.json"
echo "=== stage ZK assets to console/public ==="
rm -rf "$C/public/keys" "$C/public/zkir"
mkdir -p "$C/public"
cp -r "$C/src/managed/alphyn/keys" "$C/public/keys"
cp -r "$C/src/managed/alphyn/zkir" "$C/public/zkir"
echo "console managed + public/keys + public/zkir ready"
ls "$C/public"

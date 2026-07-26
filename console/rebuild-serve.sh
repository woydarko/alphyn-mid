#!/usr/bin/env bash
source "$HOME/.nvm/nvm.sh"; nvm use 24 >/dev/null
cd /mnt/c/Users/nabil/Documents/Alpuzz/alphyn-midnight/console
pkill -f "vite preview" 2>/dev/null || true
echo "=== vite build ==="
npx vite build 2>&1 | tail -3
cp -r src/managed/alphyn/keys dist/keys 2>/dev/null
cp -r src/managed/alphyn/zkir dist/zkir 2>/dev/null
echo "=== serving on :5173 ==="
npx vite preview --host 0.0.0.0 --port 5173

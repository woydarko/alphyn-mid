#!/usr/bin/env bash
set -e
source "$HOME/.nvm/nvm.sh"
nvm install 24 > /tmp/nvm24.log 2>&1 || true
nvm use 24 >/dev/null
cd /mnt/c/Users/nabil/Documents/Alpuzz/alphyn-midnight/console
echo "node $(node -v)  npm $(npm -v)"
echo "=== npm install ==="
npm install --legacy-peer-deps > /tmp/console-install.log 2>&1 && echo "install OK" || { echo "install FAIL"; tail -14 /tmp/console-install.log; exit 1; }
echo "=== vite build ==="
npx vite build 2>&1 | tail -45

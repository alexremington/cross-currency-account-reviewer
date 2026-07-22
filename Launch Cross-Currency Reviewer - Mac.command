#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required. Install it from https://nodejs.org/"
  read -r
  exit 1
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 20 )); then echo "Node.js 20 or newer is required."; read -r; exit 1; fi
port="${CROSS_CURRENCY_REVIEWER_PORT:-5190}"
url="http://127.0.0.1:${port}/"
if curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then
  echo "Cross-Currency Account Reviewer is already running at $url"
  open "$url"
  exit 0
fi
npm start &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
ready=0
for attempt in {1..30}; do
  if curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if (( ready == 0 )); then echo "The server did not become ready at $url"; exit 1; fi
echo "Cross-Currency Account Reviewer is running at $url"
open "$url"
wait "$server_pid"

#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

pids=()
cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[dev] backend  -> http://127.0.0.1:3000"
npm run dev:backend & pids+=("$!")
echo "[dev] zhipath  -> http://127.0.0.1:5173  (X-Client-App: zhipath-web)"
npm run dev:zhipath & pids+=("$!")
echo "[dev] codenova -> http://127.0.0.1:5180  (X-Client-App: codenova-web)"
npm run dev:codenova & pids+=("$!")

wait -n "${pids[@]}"
exit $?

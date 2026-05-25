#!/bin/sh
# Poll until the dev server responds, or exit non-zero after timeout.
# Usage: DEV_URL=http://localhost:3000 DEV_START_TIMEOUT_SEC=60 sh scripts/wait-for-dev.sh

set -e

URL="${DEV_URL:-http://localhost:3000}"
TIMEOUT_SEC="${DEV_START_TIMEOUT_SEC:-60}"
INTERVAL_SEC="${DEV_START_INTERVAL_SEC:-2}"

start=$(date +%s)
while true; do
  if curl -sf -o /dev/null -m 3 "$URL" 2>/dev/null; then
    elapsed=$(( $(date +%s) - start ))
    echo "Dev server ready at $URL (${elapsed}s)"
    exit 0
  fi
  elapsed=$(( $(date +%s) - start ))
  if [ "$elapsed" -ge "$TIMEOUT_SEC" ]; then
    echo "Dev server not ready at $URL after ${TIMEOUT_SEC}s — check logs (npm run clean && npm run dev)" >&2
    exit 1
  fi
  sleep "$INTERVAL_SEC"
done

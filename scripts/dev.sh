#!/usr/bin/env sh
set -e

PORT="${PORT:-3000}"

if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "Freeing port $PORT..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

exec next dev -p "$PORT"

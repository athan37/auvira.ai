#!/usr/bin/env sh
set -e

PORT="${PORT:-3000}"

if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "Freeing port $PORT..."
  # Try a graceful shutdown first to avoid leaving Next/webpack output half-written.
  lsof -ti :"$PORT" | xargs kill 2>/dev/null || true
  sleep 1
  if lsof -ti :"$PORT" >/dev/null 2>&1; then
    lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
fi

exec next dev -p "$PORT"

#!/usr/bin/env sh
set -e

PORT="${PORT:-3000}"

if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "Stopping dev server on port $PORT before production build..."
  lsof -ti :"$PORT" | xargs kill 2>/dev/null || true
  sleep 1
  if lsof -ti :"$PORT" >/dev/null 2>&1; then
    lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
fi

exec next build

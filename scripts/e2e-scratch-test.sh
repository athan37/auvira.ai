#!/usr/bin/env sh
set -e

# Scratch E2E: fixture plan → build → deploy poll → production verify
#
# Requires dev server with auth bypass:
#   SITE_AGENT_DEV_BYPASS_AUTH=1 npm run dev
#
# Or pass a logged-in session cookie:
#   E2E_SESSION_COOKIE='authjs.session-token=...' ./scripts/e2e-scratch-test.sh
#
# Full LLM propose (slower):
#   ./scripts/e2e-scratch-test.sh --with-llm-propose

BASE="${BASE_URL:-http://localhost:3000}"
export E2E_BASE_URL="$BASE"

echo "=== Scratch E2E (HTTP → deploy) ==="
echo "Base: $BASE"
if [ -n "$E2E_SESSION_COOKIE" ]; then
  echo "Auth: session cookie"
else
  echo "Auth: expecting SITE_AGENT_DEV_BYPASS_AUTH=1 on dev server"
fi
echo ""

node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/e2e-scratch-to-deploy.ts ' + process.argv.slice(2).map(a => JSON.stringify(a)).join(' '), {stdio:'inherit'})" "$@"

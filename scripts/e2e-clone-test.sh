#!/usr/bin/env sh
set -e

# Requires dev server with auth bypass (no browser session needed):
#   SITE_AGENT_DEV_BYPASS_AUTH=1 npm run dev
# Optional: SITE_AGENT_DEV_BYPASS_USER_ID=<mongo user _id>
#
# Or pass a logged-in session cookie:
#   E2E_SESSION_COOKIE='authjs.session-token=...' ./scripts/e2e-clone-test.sh

BASE="${BASE_URL:-http://localhost:3000}"
URL="${1:-https://servicepromagic.com/hvac}"

CURL_AUTH=()
if [ -n "$E2E_SESSION_COOKIE" ]; then
  CURL_AUTH=(-H "Cookie: $E2E_SESSION_COOKIE")
fi

echo "=== E2E Clone Test ==="
echo "Base: $BASE"
echo "URL:  $URL"
if [ -n "$E2E_SESSION_COOKIE" ]; then
  echo "Auth: session cookie"
else
  echo "Auth: expecting SITE_AGENT_DEV_BYPASS_AUTH=1 on dev server"
fi
echo ""

echo "1) Start crawl job..."
START=$(curl -s -X POST "$BASE/api/projects/clone/start-crawl" \
  -H "Content-Type: application/json" \
  "${CURL_AUTH[@]}" \
  -d "{\"url\":\"$URL\",\"projectName\":\"ServiceProMagic HVAC E2E\"}")

echo "$START" | head -c 500
echo ""

JOB_ID=$(echo "$START" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('jobId',''))" 2>/dev/null || true)
if [ -z "$JOB_ID" ]; then
  echo "FAILED: could not get jobId"
  echo "$START" | python3 -m json.tool 2>/dev/null || echo "$START"
  if echo "$START" | grep -qi unauthorized; then
    echo ""
    echo "Hint: start dev with SITE_AGENT_DEV_BYPASS_AUTH=1 or set E2E_SESSION_COOKIE"
  fi
  exit 1
fi
echo "Job ID: $JOB_ID"
echo ""

echo "2) Process crawl + plan (may take 1-3 min)..."
PROCESS=$(curl -s -m 600 -X POST "$BASE/api/projects/clone/jobs/$JOB_ID/process" "${CURL_AUTH[@]}")
echo "$PROCESS" | python3 -m json.tool 2>/dev/null | head -30 || echo "$PROCESS"
echo ""

echo "3) Poll job status..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  JOB=$(curl -s "$BASE/api/projects/clone/jobs/$JOB_ID" "${CURL_AUTH[@]}")
  STATUS=$(echo "$JOB" | python3 -c "import sys,json; j=json.load(sys.stdin); print(j.get('job',j).get('status',''))" 2>/dev/null || echo "?")
  echo "  poll $i: status=$STATUS"
  if [ "$STATUS" = "review_ready" ]; then
    break
  fi
  if [ "$STATUS" = "failed" ]; then
    echo "$JOB" | python3 -m json.tool 2>/dev/null | head -40
    exit 1
  fi
  sleep 3
done

if [ "$STATUS" != "review_ready" ]; then
  echo "FAILED: expected review_ready, got $STATUS"
  exit 1
fi
echo ""

echo "4) Build preview (may take 1-2 min)..."
BUILD=$(curl -s -m 600 -X POST "$BASE/api/projects/clone/jobs/$JOB_ID/build-preview" "${CURL_AUTH[@]}")
echo "$BUILD" | python3 -m json.tool 2>/dev/null || echo "$BUILD"
echo ""

PREVIEW_URL=$(echo "$BUILD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('preview',{}).get('url',''))" 2>/dev/null || true)
OK=$(echo "$BUILD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null || echo "False")
PROJECT_ID=$(echo "$BUILD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('projectId',''))" 2>/dev/null || true)
AUTO_SAVE_OK=$(echo "$BUILD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('autoSave',{}).get('ok', d.get('projectId') is not None))" 2>/dev/null || echo "False")

if [ "$OK" != "True" ]; then
  echo "FAILED: build-preview returned ok=$OK"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "FAILED: build-preview did not return projectId (auto-handoff)"
  echo "$BUILD" | python3 -m json.tool 2>/dev/null | head -40 || echo "$BUILD"
  exit 1
fi

echo "Auto-handoff projectId: $PROJECT_ID (autoSave ok=$AUTO_SAVE_OK)"
echo "Editor path: /projects/$PROJECT_ID"

echo "5) Health check preview: $PREVIEW_URL"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$PREVIEW_URL" || echo "000")
echo "Preview HTTP: $HTTP"

if [ "$HTTP" != "200" ]; then
  echo "FAILED: preview not reachable"
  exit 1
fi

echo ""
echo "=== E2E PASSED ==="
echo "Review: $BASE/clone/jobs/$JOB_ID"
echo "Preview: $PREVIEW_URL"

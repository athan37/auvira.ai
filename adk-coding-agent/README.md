# ADK-Style Coding Agent (dev-only)

A developer-only coding agent for the AI website editor, similar to Google ADK / Claude Code.

**Owner edits on `/projects/[id]` now use the TypeScript agent in `src/lib/project-workspace/website-edit-agent/`.** This Python service is only needed for `/dev-coding-agent`.

## Overview

This is **separate** from the owner-facing website edit agent.

| | Owner Agent | Coding Agent |
|---|---|---|
| **Users** | Business owners | Developers |
| **Access** | `/projects/{id}` | `/dev-coding-agent` |
| **What it does** | Edits draftSiteSpec | Edits source code |
| **Tools** | LLM chat only | ripgrep, file read/write, patch, build |
| **Risk** | Low (data only) | High (can modify code) |

## Architecture

```
Browser → Next.js /dev-coding-agent
       → /api/dev-coding-agent/run-stream (SSE)
       → Python FastAPI :8001
       → MiniMax Proxy :3457 (LLM)
       → Filesystem / git (tools)
```

## Safety Rules

- Disabled unless `DEV_CODING_AGENT_ENABLED=true`
- Cannot read/write: `.env`, `.env.*`, `.git`, `node_modules`, `.next`, `.tmp`, `dist`, `build`
- Cannot run arbitrary commands — only allowlisted:
  - `npm run build`
  - `npm test`
  - `npm run lint`
  - `npx tsc --noEmit`
  - `git diff`, `git status`, `git diff --stat`
- All commands timeout after 120s
- Max 8 iterations per task

## Running

### 1. Start MiniMax proxy (port 3457)

```bash
# The proxy should already be running at localhost:3457
```

### 2. Start Next.js app

```bash
source ~/.nvm/nvm.sh && nvm use 20.20.2
npm run dev
```

### 3. Start coding agent service

```bash
cd adk-coding-agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### 4. Open the UI

```
http://localhost:3000/dev-coding-agent
```

### 5. Set environment

In the main project `.env`:
```
DEV_CODING_AGENT_ENABLED=true
ADK_CODING_AGENT_URL=http://localhost:8001
```

## Preset Tasks

The UI has preset buttons:

1. **Improve preview CSS** — Inspect preview CSS/HTML generators, improve polish
2. **Add template variant** — Add a new premium home-services template
3. **Fix build error** — Run build, fix first error, rerun
4. **Add regression test** — Add tests for chat edit and deploy

## LLM Backend

Uses the local MiniMax proxy:

- **Regular JSON**: `POST http://localhost:3457/minimax-json`
- **Streaming SSE**: `POST http://localhost:3457/minimax-json/stream`

Request format:
```json
{
  "system": "...",
  "prompt": "...",
  "schema": {...}
}
```

Response format (streaming):
```
data: {"token":"...","done":false}
data: {"done":true,"data":{...}}
```

## Tools

| Tool | Description |
|------|-------------|
| `search_code` | ripgrep search with results |
| `search_files` | Find files by glob pattern |
| `read_file` | Read UTF-8 file (max 30KB) |
| `write_file` | Write UTF-8 file |
| `apply_patch` | Apply unified diff via `git apply` |
| `run_command` | Run allowlisted shell command |
| `run_validation` | Run `npm run build` + `npm test` |
| `finish` | End loop, return summary |

## Agent Loop

```
1. User task → LLM
2. LLM returns: { thought, action: { tool, args } }
3. Execute tool, add result to conversation
4. Repeat until tool === "finish" or max 8 iterations
5. Return { summary, changedFiles, validation, steps }
```

## Testing Safety

Try these — they should all be **rejected**:

```bash
# Try to read .env
read_file path=".env"

# Try to delete files
run_command command="rm -rf .tmp"

# Try to push git
run_command command="git push"

# Try to install packages
run_command command="npm install"
```

Expected: all return `{"ok": false, "error": "Blocked/Not in allowlist"}`
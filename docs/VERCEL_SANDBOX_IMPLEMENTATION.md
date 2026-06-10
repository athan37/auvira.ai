# Vercel Sandbox — Implementation Plan

**Owner decision:** 30-minute sandbox sessions are acceptable. Goal is local-like preview (`git clone` → `npm install` → `npm run dev` → hot reload) on production (Vercel), with chat edits on the **same filesystem** as the dev server.

**Repo:** `google-rapid-agent` (package `ai-website-migration-agent`)  
**Do not read or commit `.env`.** Update `.env.example` only.

---

## Problem (current state)

On `VERCEL=1`, `bootstrapProjectPreviewHosted()`:
- Sets iframe to `deployment.liveUrl` (`previewMode: 'live'`) — production build, not `next dev`.
- Calls `ensureGitWorkspace()` → `git clone` → **fails** (`git: command not found`).

`edit/stream` also calls `ensureGitWorkspace()` → edits fail on Vercel.

Local path (`bootstrapGitlabProject`) works: clone → install → `next dev` → `/api/.../preview/proxy` → `127.0.0.1:port`.

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Vercel Serverless (Next.js app)                              │
│  - Auth, UI, Mongo, GitLab publish, deploy orchestration     │
│  - bootstrap / status / release APIs                         │
│  - edit/stream orchestration (LLM + tools)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ @vercel/sandbox SDK
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Vercel Sandbox (persistent VM per project)                   │
│  name: site-agent-{projectId}                                 │
│  timeout: 30m (configurable via SITE_AGENT_SANDBOX_TIMEOUT)   │
│  /vercel/sandbox/workdir or /app → cloned GitLab repo         │
│  git clone, npm install, npm run dev (detached, port 3000)    │
│  Public URL: sandbox.domain(3000)                             │
└─────────────────────────────────────────────────────────────┘
```

**Single workspace rule:** All file mutations for preview + edit must target the **sandbox working directory**, not Lambda `/tmp`, when sandbox is active.

---

## Non-goals (this phase)

- 24/7 always-on sandboxes
- Full IDE / terminal UI (Cursor clone)
- Replacing GitLab API publish path
- Sandbox for non-GitLab (static `siteSpec`) projects — keep existing static workspace
- Clone-job build preview in sandbox (optional later)

---

## Dependencies & env

### Package

```bash
npm install @vercel/sandbox
```

Docs: https://vercel.com/docs/vercel-sandbox  
SDK: `Sandbox.getOrCreate`, `sandbox.runCommand`, `sandbox.writeFiles`, `sandbox.domain(port)`

### Vercel project env (dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `VERCEL_SANDBOX_TOKEN` or token from `vercel env pull` | Yes on Vercel | Sandbox API auth (see Vercel docs; may use OIDC on Vercel deployments) |
| `SITE_AGENT_SANDBOX_TIMEOUT` | No | Default `30m` |
| `SITE_AGENT_SANDBOX_ENABLED` | No | Default `1` when `VERCEL=1`; set `0` to fall back to live URL mode |
| `GITLAB_TOKEN` | Yes | Clone via HTTPS: `https://oauth2:TOKEN@gitlab.com/...` |
| Existing `GITLAB_*`, `MONGODB_URI`, `GEMINI_*` | Yes | Unchanged |

### Feature flag

```ts
// src/lib/runtime/isSandboxPreviewEnabled.ts
export function isSandboxPreviewEnabled(): boolean {
  if (!isVercelServerless()) return false;
  if (process.env.SITE_AGENT_SANDBOX_ENABLED === '0') return false;
  return true;
}
```

Local dev (`VERCEL` unset): **unchanged** — keep `bootstrapGitlabProject` (no Sandbox).

---

## Mongo / model changes

Extend `IPreview` in `src/models/WebsiteProject.ts`:

```ts
export interface IPreview {
  status: 'not_started' | 'starting' | 'building' | 'ready' | 'failed' | 'stopped';
  url?: string;
  port?: number;
  workspacePath?: string;
  startedAt?: Date;
  error?: string;
  previewMode?: 'live' | 'workspace' | 'sandbox';
  sandboxId?: string;      // stable sandbox name suffix
  sandboxExpiresAt?: Date; // optional UI hint
}
```

Extend `ICodeWorkspace` (optional but useful):

```ts
  sandboxWorkspace?: boolean; // true when edits should use sandbox gateway
```

Store on bootstrap success:
- `preview.previewMode = 'sandbox'`
- `preview.url = sandboxPublicUrl` (from `sandbox.domain(3000)`)
- `preview.port = 3000` (logical; proxy may not be needed)
- `codeWorkspace.workspacePath = '/vercel/sandbox'` or SDK-documented workdir constant
- `codeWorkspace.source = 'gitlab'`
- `codeWorkspace.sandboxWorkspace = true`

---

## File layout (new modules)

```
src/lib/sandbox/
  sandboxClient.ts          # lazy Sandbox SDK init, getToken
  sandboxNames.ts           # site-agent-{projectId} naming + validation
  bootstrapProjectSandbox.ts # getOrCreate, onCreate, onResume, health check
  sandboxWorkspaceGateway.ts # read/write/list/exec for agent tools
  stopProjectSandbox.ts     # stop on release (optional snapshot)
  types.ts
```

---

## Phase 1 — Sandbox preview bootstrap (P0)

**Replace** `bootstrapProjectPreviewHosted` when `isSandboxPreviewEnabled()`.

### `bootstrapProjectSandbox.ts`

1. **Name:** `site-agent-${projectId}` (sanitize ObjectId hex only).
2. **`Sandbox.getOrCreate({ name, timeout: parseTimeout('30m'), runtime: 'node24', ports: [3000], ... })`**
3. **`onCreate` (first time only):**
   - `git clone --branch {branch} --single-branch {authenticatedRepoUrl} .` in workdir  
     - Build URL: `project.gitlab.httpUrlToRepo` with `oauth2:${GITLAB_TOKEN}@` injected (never log URL).
   - `npm install --legacy-peer-deps` (match clone build-preview)
   - Optional: `npm install -g rg` or `dnf install ripgrep` if search tool needed
4. **`onResume`:**
   - If `node_modules` missing → `npm install`
   - Start dev server detached: `npm run dev -- -H 0.0.0.0 -p 3000`
   - Wait for HTTP 200 on port 3000 (reuse `waitForPreviewReady` with public URL)
5. **Health:** `GET sandbox.domain(3000)` — if unhealthy, rerun onResume dev start.
6. **Persist** Mongo fields above; `setupStage` progression: `cloning` → `installing` → `starting_server` → `ready`.

### `bootstrapProjectPreview.ts`

```ts
if (isVercelServerless()) {
  if (isSandboxPreviewEnabled()) {
    await bootstrapProjectSandbox(project, userId);
  } else {
    await bootstrapProjectPreviewHosted(project, userId); // fallback
  }
  return;
}
```

### `getWorkspaceStatusFromProject`

Add branch for `previewMode === 'sandbox'`:
- `ready` when `preview.status === 'ready'` && `preview.url` set
- `previewHealthy`: HTTP check sandbox URL (short timeout)
- `previewMode: 'sandbox'`
- Do **not** require `preview.port` localhost check for sandbox

### `ProjectPreviewFrame.tsx`

When `previewMode === 'sandbox'` (or `live` with sandbox URL pattern):
- iframe `src={preview.url}` directly (public sandbox URL)
- Label: **"Dev preview"** (not "Live website")
- Optional: extend iframe `sandbox` attribute if needed for Next dev assets

**Fallback:** If sandbox bootstrap throws, set `previewMode: 'live'` + `deployment.liveUrl` + error message (same as today).

### Routes

| Route | Change |
|-------|--------|
| `workspace/bootstrap/route.ts` | Already `maxDuration = 300` — keep |
| `workspace/status/route.ts` | Return sandbox fields |
| `workspace/release/route.ts` | Call `stopProjectSandbox` when sandbox active |

### Release / TTL

- On editor leave (`releaseWorkspaceOnLeave` → API): **`sandbox.stop()`** or SDK equivalent (best-effort).
- Align with `SITE_AGENT_SCRATCH_TTL_MS` (30m) — document that sandbox timeout matches.
- Do **not** delete GitLab repo; only stop VM.

---

## Phase 2 — Edits in sandbox (P0)

**Problem:** `edit/stream` uses `ensureGitWorkspace` + local `fs` tools → wrong disk on Vercel.

### Approach: `WorkspaceGateway` abstraction

```ts
// src/lib/project-workspace/workspaceGateway.ts
export interface WorkspaceGateway {
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, content: string): Promise<void>;
  searchFiles(pattern: string): Promise<string[]>;
  applyPatch(patch: string): Promise<{ ok: boolean; error?: string }>;
  computeHashes(): Promise<Record<string, string>>;
  getWorkspacePath(): string; // logical path for logging
}
```

Implementations:
- `LocalFsGateway` — current behavior (`fs` + `rg` + `git apply`)
- `SandboxGateway` — `sandbox.runCommand` / `writeFiles` / `readFile` via SDK

Wire in `edit/stream/route.ts`:

```ts
const gateway = project.codeWorkspace?.sandboxWorkspace
  ? await getSandboxGateway(projectId)
  : new LocalFsGateway(workspacePath);
```

Refactor `edit-shared` tools to accept `WorkspaceGateway` in `ToolContext` (minimal surface).

### `applyPatch` on sandbox

Prefer: `git apply` **inside** sandbox via `runCommand` (git exists there).  
Fallback: pure-JS patch apply in gateway if git apply fails.

### `edit/stream/route.ts`

- `export const maxDuration = 300`
- Remove direct `ensureGitWorkspace` when sandbox gateway active; ensure sandbox bootstrapped first (call bootstrap or getOrCreate lightweight resume).

### Save / publish

- `publishWorkspaceToGitLab`: read files via gateway or from sandbox (`runCommand git status` OR hash diff from gateway).
- For sandbox: after publish, optional `git pull` in sandbox to sync — or rely on edited files already matching commit.

---

## Phase 3 — Polish (P1)

1. **Bootstrap lock** — reuse `bootstrapLocks` Map for sandbox (prevent duplicate create storms).
2. **Logging** — `logProjectStep` for sandbox steps (no secrets).
3. **Upload assets** — `upload-assets/route.ts` write via gateway.
4. **Diff API** — `code-agent/diff/route.ts` use gateway hashes.
5. **Tests:**
   - Unit: `sandboxNames`, `isSandboxPreviewEnabled`, gateway path resolution (mocked SDK)
   - Integration: mock `@vercel/sandbox` module; verify bootstrap sets Mongo fields
6. **`.env.example`** — document sandbox vars.
7. **README.md** — section "Vercel Sandbox preview".

---

## Security

- Sandbox name must be derived from `projectId` + verify `getOwnerProject` on every API.
- Never return `GITLAB_TOKEN` or authenticated clone URL to client.
- One sandbox per project (not per user) — acceptable for owner-only projects; document risk if multi-tenant editor added later.
- Rate-limit bootstrap if needed (existing lock).

---

## Acceptance criteria

### Preview
- [ ] On Vercel with sandbox enabled, opening project shows iframe with `next dev` (inspect: `/_next/static` loads, edits hot-reload).
- [ ] Bootstrap completes within `maxDuration` or returns clear error + live URL fallback.
- [ ] `workspace/status` returns `previewMode: 'sandbox'`, `ready: true`, valid `liveUrl`/`url`.

### Edit
- [ ] `POST edit/stream` with "change background to red" returns `done` with `ok: true` on Vercel.
- [ ] Changed file visible in sandbox preview without publish.
- [ ] Save/publish still commits to GitLab via API.

### Lifecycle
- [ ] Leaving project triggers release → sandbox stops (best-effort).
- [ ] Reopening project resumes sandbox (<2 min resume target; document if slower).

### Local regression
- [ ] `VERCEL` unset: existing local bootstrap + proxy unchanged.
- [ ] `npm test` passes; add new tests for sandbox helpers.

---

## Implementation order (for agent)

1. Add `@vercel/sandbox`, env helpers, types, `sandboxNames.ts`
2. `bootstrapProjectSandbox.ts` + wire `bootstrapProjectPreview.ts`
3. Update `getWorkspaceStatusFromProject` + `ProjectPreviewFrame.tsx`
4. `WorkspaceGateway` + `SandboxGateway` + tool refactor
5. `edit/stream` + `maxDuration` + save/publish paths
6. `workspace/release` → stop sandbox
7. Tests + `.env.example` + README
8. Manual verification checklist on Vercel preview deployment

---

## Rollback

Set `SITE_AGENT_SANDBOX_ENABLED=0` → reverts to `bootstrapProjectPreviewHosted` (live URL iframe).

---

## References (code)

| File | Role |
|------|------|
| `src/lib/project-workspace/bootstrapProjectPreview.ts` | Main switch local / hosted / **sandbox** |
| `src/lib/project-workspace/gitWorkspaceManager.ts` | Local clone (keep for non-Vercel) |
| `src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts` | Edit entry |
| `src/lib/project-workspace/edit-shared/tools/*.ts` | Tools to gateway |
| `src/lib/gitlab/publishWorkspace.ts` | Publish (hash/status) |
| `src/components/ProjectPreviewFrame.tsx` | iframe URL |
| `src/lib/runtime/isVercelServerless.ts` | `VERCEL=1` detect |

---

## Vercel Sandbox SDK sketch (reference)

```ts
import { Sandbox } from '@vercel/sandbox';

const sandbox = await Sandbox.getOrCreate({
  name: `site-agent-${projectId}`,
  timeout: process.env.SITE_AGENT_SANDBOX_TIMEOUT ?? '30m',
  runtime: 'node24',
  ports: [3000],
  onCreate: async (sbx) => {
    await sbx.runCommand({
      cmd: 'git',
      args: ['clone', '--branch', branch, '--single-branch', authRepoUrl, '.'],
    });
    await sbx.runCommand({ cmd: 'npm', args: ['install', '--legacy-peer-deps'] });
  },
  onResume: async (sbx) => {
    await sbx.runCommand({
      cmd: 'npm',
      args: ['run', 'dev', '--', '-H', '0.0.0.0', '-p', '3000'],
      detached: true,
    });
  },
});

const previewUrl = sandbox.domain(3000);
```

Verify exact API against installed `@vercel/sandbox` version README — adjust types/imports accordingly.

---

## Open questions (agent: resolve during impl)

1. Sandbox auth on Vercel deployments: OIDC vs `VERCEL_SANDBOX_TOKEN` — use Vercel-recommended approach for production.
2. Exact workdir path inside sandbox for `writeFiles` / relative paths.
3. Whether iframe can load `sandbox.domain()` directly or needs CSP / `X-Frame-Options` handling — test and add headers override on dev server if needed (`next.config.js` in **customer** repo template if required).
4. Gemini latency + 300s `maxDuration` on `edit/stream` — monitor.

---

*Plan version: 1.0 — 2026-05-23*

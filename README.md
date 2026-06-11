# Auvira.ai

**Your website. Built with AI.** Describe your business in plain language — Auvira.ai builds your website, no code required.

> **Dev note:** npm package / repo folder name remains `ai-website-migration-agent` for tooling compatibility.

Turn an outdated business website into a clean live site, or start from a short prompt. Review a draft preview, refine in chat, and publish when it feels right.

**Design system:** See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for UI tokens, components, and motion. Theme inventory: [`docs/STYLING_THEMES.md`](docs/STYLING_THEMES.md).

**Package name:** `ai-website-migration-agent`  
**Node:** `>=20 <21` (see `engines` in [`package.json`](package.json))

---

## Overview

Auvira.ai is a Next.js application that:

1. **Extracts** business facts from an existing site (clone mode) or a short intake form (scratch mode)
2. **Generates** a one-page Next.js + Tailwind site from deterministic templates — the LLM produces JSON (`siteConfig`, copy, colors), not React source
3. **Validates** every build locally before GitLab commit or Vercel deploy
4. **Maintains** the site via a GitLab-backed edit agent: chat edits run against a workspace preview, with rollback and diff review

Authenticated owners get a dashboard, per-project editor (preview + chat + publish), optional product catalog, and site health monitoring.

---

## Product modes

| Mode | Entry | Flow |
|------|--------|------|
| **Clone** | Dashboard → **Refresh from URL** or `/projects/new/clone` | Crawl → plan → template pick → build preview → save backup → publish live |
| **Scratch** | Dashboard → **Start with a prompt** or `/projects/new/scratch` | Intake form → plan → build → publish |

### Owner-facing UI

| Area | What owners see |
|------|-----------------|
| **Dashboard** | Getting-started checklist; in-progress clone jobs; project list |
| **Clone wizard** | Phase progress; template gallery; **Save backup copy** / **Publish live site** |
| **Editor** (`/projects/[projectId]`) | Draft preview; Chat / Changes / Publish tabs; sticky publish when there are unpublished edits |

Primary actions avoid GitLab/Vercel jargon — **backup copy**, **draft preview**, **live website**.

---

## Architecture

```
Owner UI (Next.js)
 │
 ├─ Clone / scratch agents ──► LLM (JSON siteSpec / websitePlan)
 │         │
 │         ▼
 │   Builder templates ──► generated Next.js site
 │         │
 │         ▼
 │   Build gate (npm install + next build)
 │         │
 │         ▼
 └─ Edit agent ──► GitLab workspace ◄──► GitLab repo ──► Vercel deploy
                           │
                           └─ Preview: local proxy (dev) or Vercel Sandbox (production)
```

### Core design rules

- **LLM generates data only** — section copy, CTAs, colors, business facts — never React components or Tailwind class strings in generated output
- **Templates render the page** — `src/lib/builder/pageTemplate.ts` and related builder code read `siteConfig.ts`
- **Build gate** — generated and edited sites must pass `npm run build` in a temp workspace before commit/deploy; failed edits do not replace the live site
- **GitLab is required for owner edits** — projects without a complete GitLab link return **409** on edit APIs
- **Deploy consistency** — publish syncs the full workspace to GitLab, waits for commit visibility, then triggers a SHA-pinned Vercel build

### Website Edit Agent

Owner chat edits on `/projects/[projectId]` use the TypeScript edit agent:

```
buildEditContext → resolveEditTarget → planEdit → executePlan → domain tools → verify → summarize
```

- **HTTP:** `POST /api/projects/[projectId]/code-agent/edit/stream` (SSE)
- **Runner:** `src/lib/project-workspace/websiteEditRunner.ts`
- **Agent:** `src/lib/project-workspace/edit-agent/index.ts`

Owners can **drag a section from the preview iframe onto chat** to pin a `selectedTarget` for scoped edits. See [`docs/EDIT_AGENT.md`](docs/EDIT_AGENT.md) and [`AGENTS.md`](AGENTS.md) (preview bridge, focus stack, inner-element styling).

### Preview modes

| Environment | Preview |
|-------------|---------|
| **Local dev** | Git clone → scratch disk → `next dev` → `/api/projects/.../preview/proxy` |
| **Vercel (`VERCEL=1`)** | [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox): isolated VM, `git clone` + `npm run dev` (~30 min TTL). See [`docs/VERCEL_SANDBOX_IMPLEMENTATION.md`](docs/VERCEL_SANDBOX_IMPLEMENTATION.md) |
| **Live iframe** | Published Vercel URL (`previewMode: 'live'`) — no section drag-to-chat |

### Other features

- **Product catalog (Phase 2)** — MongoDB `Product` model; sync into draft `siteConfig`; static export with inquiry CTAs (no native checkout)
- **Site Manager** — scheduled checks (uptime, phone, hours, services, banner expiry); incidents and fix proposals via `/api/projects/[projectId]/site-manager/*`
- **Analytics** — optional runtime on generated sites; collect endpoint at `/api/analytics/collect`
- **Commerce (Phase 3, not enabled)** — Stripe checkout stub in `src/lib/commerce/stripeConfig.ts`; not wired in `.env.example`

---

## Tech stack

| Layer | Technology |
|-------|------------|
| App | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Auth | Auth.js (NextAuth v5), Google OAuth |
| Data | MongoDB (Mongoose) — users, projects, chat, catalog, site health |
| Code storage | GitLab (generated customer sites) |
| Hosting | Vercel (this app + customer sites) |
| LLM | Google Gemini (clone, scratch, edit agent, planning) |
| Preview (prod) | `@vercel/sandbox` |
| Tests | Vitest |

---

## Prerequisites

- **Node.js 20** (`engines` in `package.json`)
- **MongoDB** — local or Atlas (`MONGODB_URI`)
- **Google OAuth** app — for sign-in
- **GitLab** personal access token + group ID — repo creation for generated sites
- **Gemini API key** (`GEMINI_API_KEY`) — generation, planning, and edit agent (required for LLM tests)
- **Optional:** `SITE_AGENT_VERCEL_TOKEN` — deploy **customer** sites via Vercel API (not required to host this app on Vercel)
- **Optional:** `rg` (ripgrep) on PATH — complex edit-agent tool loop

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy [`.env.example`](.env.example) to **`.env.local`** (Next.js dev) and/or **`.env`** (Vitest via `node --env-file=.env`):

```bash
cp .env.example .env.local
cp .env.example .env   # optional; recommended for npm test scripts
```

Fill in values — **never commit** `.env` or `.env.local`.

### 3. GitLab token

Create a GitLab personal access token with scopes: `api`, `read_user`, `read_repository`, `write_repository`. Set `GITLAB_TOKEN` and `GITLAB_GROUP_ID`.

### 4. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth 2.0 Client ID (Web)
2. Redirect URI: `http://localhost:3000/api/auth/callback/google`
3. JavaScript origin: `http://localhost:3000`
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`)

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in → dashboard → create or open a project.

For dev auth bypass in local scripts only, see commented flags in `.env.example` (`SITE_AGENT_DEV_BYPASS_AUTH`).

---

## Environment variables

Names from [`.env.example`](.env.example) — set values locally; do not commit secrets.

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | LLM provider (default `gemini`; alias `google`) |
| `GEMINI_API_KEY` | Google Gemini API key (`GOOGLE_API_KEY` alias) |
| `GEMINI_API_URL` | Gemini API base (default `https://generativelanguage.googleapis.com/v1beta`) |
| `GEMINI_MODEL` | Gemini model id (default `gemini-flash-latest`) |
| `WEBSITE_EDIT_MAX_TOKENS` | Optional token cap for edits |
| `MONGODB_URI` | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | Auth.js secret (preferred) |
| `NEXTAUTH_SECRET` | Legacy alias for auth secret |
| `NEXTAUTH_URL` | App URL (local dev; optional on Vercel) |
| `AUTH_TRUST_HOST` | Optional Auth.js trust host |
| `SITE_AGENT_DEV_BYPASS_AUTH` | Dev-only auth bypass (server) |
| `NEXT_PUBLIC_SITE_AGENT_DEV_BYPASS_AUTH` | Dev-only auth bypass (client) |
| `SITE_AGENT_DEV_BYPASS_USER_ID` | Dev bypass user id for scripts |
| `GITLAB_TOKEN` | GitLab personal access token |
| `GITLAB_GROUP_ID` | GitLab group for new repos |
| `GITLAB_BASE_URL` | GitLab API base (default `https://gitlab.com/api/v4`) |
| `SITE_AGENT_VERCEL_TOKEN` | Vercel API token for customer site deploys |
| `SITE_AGENT_VERCEL_TEAM_ID` | Optional Vercel team id |
| `VERCEL_PROJECT_PREFIX` | Prefix for generated Vercel project names |
| `NEXT_PUBLIC_APP_URL` | Public app URL override |
| `SITE_AGENT_SCRATCH_DIR` | Custom scratch workspace path |
| `SITE_AGENT_SCRATCH_TTL_MS` | Scratch TTL (default 30 min) |
| `SITE_AGENT_RUN_BUILD_GATE` | Force build gate on |
| `SITE_AGENT_SKIP_BUILD_GATE` | Skip build gate |
| `VERCEL_SANDBOX_TOKEN` | Sandbox SDK token (local testing) |
| `SITE_AGENT_SANDBOX_TIMEOUT` | Sandbox session timeout (default `30m`) |
| `SITE_AGENT_SANDBOX_ENABLED` | Set `0` to disable sandbox preview on Vercel |
| `VITEST_LLM_RETRY` | Retries for live LLM tests (default `2`) |

---

## npm scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Next.js dev server (`scripts/dev.sh`, frees port 3000) |
| `dev:wait` | Wait for dev server ready |
| `build` | Production build (`scripts/build.sh`) |
| `build:clean` | Remove `.next` then build |
| `start` | Start production server |
| `clean` | Remove `.next` |
| `lint` | ESLint (Next.js) |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest unit suite (excludes `*.llm.test.ts` and gated integration files) |
| `test:watch` | Vitest watch mode |
| `test:all` | **Final gate:** `test` + `test:contracts` (no live LLM) |
| `test:all:llm` | Opt-in: `test:all` + full LLM + contract smoke (run only when you ask) |
| `test:contracts` | Fast deterministic section-color / builder contracts (~1s) |
| `test:edit-agent` | Edit-agent unit tests |
| `test:section-color` | Section color + sandbox validation tests |
| `test:integration` | Section style preview sync integration test |
| `test:llm` | Full live LLM planner + edit-agent integration (`VITEST_LLM_SUITE=1`) |
| `test:llm:contracts` | LLM section-color smoke (3 synthetic cases) |
| `test:llm:edit-errors` | Copy, structural, planner guardrails LLM suite |
| `test:llm:edit-agent` | Edit-agent smoke + hard + gradient LLM subset |
| `test:llm:edit-agent:hard` | Hard edit-agent LLM cases only |
| `test:llm:gradients` | Section gradient background LLM tests |
| `test:llm:presentation` | Section presentation LLM suite (gradients, contact card, inner element) |
| `test:llm:inner-element` | Inner element style LLM tests |
| `test:llm:section-catalog` | Section catalog hard LLM tests |
| `test:scratch-live` | Live scratch workflow script |
| `test:diff-local` | Local diff API script |
| `test:build-gate-local` | Local build gate script |

LLM scripts load `.env` via `node --env-file=.env`. Live LLM tests need `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) with `LLM_PROVIDER=gemini`.

---

## Testing

| Tier | Command | When |
|------|---------|------|
| Fast deterministic | `npm run test:contracts` | Section color pipeline, wiring (~1s) |
| Full unit (no LLM) | `npm test` | CI default (~5–15s) |
| LLM smoke | `npm run test:llm:contracts` | 3 synthetic section-color cases |
| Live LLM integration | `npm run test:llm` | **Only when you explicitly request** (API cost) |
| LLM edit-errors | `npm run test:llm:edit-errors` | Copy, structural, planner guardrails |
| **Final gate** | `npm run test:all` | Unit + contracts (no LLM) |
| **LLM gate (opt-in)** | `npm run test:all:llm` | Unit + contracts + full LLM |

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): `typecheck` → `test` → `test:contracts` → `build` — no live LLM (no secrets in GitHub).

Before merge on agent/edit work, run locally:

```bash
npm run test:all
npm run typecheck && npm run build   # when types or build paths change
```

For agent workflow details, test harness paths, and preview drag-to-chat troubleshooting, see **[`AGENTS.md`](AGENTS.md)**.

- Default unit timeout: **5s**; live LLM: **120s** per test (`tests/llmTestGate.ts`)
- LLM retries: **2** by default (`VITEST_LLM_RETRY`)

---

## Key paths

| Area | Path |
|------|------|
| Builder / templates | `src/lib/builder/` |
| Clone workflow | `src/lib/clone/`, `src/app/api/projects/clone/` |
| Scratch workflow | `src/lib/agent/`, `src/app/api/projects/scratch/` |
| Edit agent | `src/lib/project-workspace/edit-agent/` |
| Edit runner | `src/lib/project-workspace/websiteEditRunner.ts` |
| Section color / presentation | `src/lib/project-workspace/sectionPresentationEdit.ts` |
| siteConfig mutations | `src/lib/project-workspace/siteConfigMutations.ts` |
| Edit context / selected target | `src/lib/project-workspace/edit-context/` |
| Domain tools | `src/lib/project-workspace/tools/domain/` |
| Preview proxy + bridge | `src/lib/preview/`, `src/lib/project-workspace/previewProxyHandler.ts` |
| Vercel deploy | `src/lib/vercel/` |
| GitLab client | `src/lib/gitlab/` |
| Vercel Sandbox | `src/lib/sandbox/` |
| Site Manager | `src/lib/site-manager/` |
| Models | `src/models/` |
| Project editor UI | `src/app/projects/[projectId]/page.tsx` |
| Synthetic test fixtures | `tests/support/syntheticSiteWorkspace.ts` |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [`AGENTS.md`](AGENTS.md) | AI agent / contributor guide: credentials, testing gates, key paths, preview drag-to-chat |
| [`docs/EDIT_AGENT.md`](docs/EDIT_AGENT.md) | Edit agent pipeline, selected target, focus stack |
| [`docs/VERCEL_SANDBOX_IMPLEMENTATION.md`](docs/VERCEL_SANDBOX_IMPLEMENTATION.md) | Sandbox architecture and env on Vercel |

---

## Deployment

### This app (Auvira.ai)

1. Connect the GitHub repo to [Vercel](https://vercel.com)
2. **Production branch:** `main`
3. Set environment variables (Production + Preview): at minimum `MONGODB_URI`, `AUTH_SECRET`, Google OAuth, GitLab, `GEMINI_API_KEY`; optional `SITE_AGENT_VERCEL_TOKEN` for customer deploys
4. On Vercel, `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` are usually auto-derived (`VERCEL=1`, `next.config.js`)
5. Add production URL to Google OAuth redirect URIs: `https://<your-domain>/api/auth/callback/google`

Do **not** run `vercel deploy` from CI if GitHub integration already deploys — that double-deploys.

### Customer sites

After GitLab commit, the app can create/link a Vercel project, disable SSO on the preview project, and trigger deploy hooks. Publish flow verifies GitLab commit SHA before marking the site **Live**.

Deploy consistency check (manual / CI):

```bash
npx tsx scripts/e2e-deploy-verify.ts --project-id <id>
```

### Vercel Sandbox (production editor)

When `VERCEL=1`, owner previews use Vercel Sandbox by default. Disable with `SITE_AGENT_SANDBOX_ENABLED=0` to fall back to the published live URL iframe.

---

## API reference (selected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List owner projects |
| GET | `/api/projects/[projectId]` | Project detail |
| POST | `/api/projects/clone` | Start clone flow |
| POST | `/api/projects/scratch/propose` | Generate website plan |
| POST | `/api/projects/scratch/build` | Build from plan |
| POST | `/api/projects/[projectId]/code-agent/edit/stream` | Owner edit (SSE) |
| GET | `/api/projects/[projectId]/messages` | Chat history |
| GET | `/api/projects/[projectId]/deployment-status` | Vercel deployment status |
| GET/POST | `/api/projects/[projectId]/catalog` | Product catalog |

Legacy/smoke routes (no auth in some setups): `/api/agent/rebuild`, `/api/agent/edit`, `/api/agent/build-from-plan`, `/api/agent/propose-website-plan`, `/api/llm/generate-json`, `/api/gitlab/test-create-project`.

---

## Contributing

- Prefer synthetic contract tests (`tests/support/syntheticSiteWorkspace.ts`) over site-specific fixtures except frozen regressions
- Default merge gate: `npm run test:all` (no LLM). Run `npm run test:all:llm` only when you want live LLM verification.
- Production deploys from `main`; PR branches get Vercel preview URLs when enabled

For AI agents and detailed edit-agent conventions, see **[`AGENTS.md`](AGENTS.md)**.

---

## Smoke tests

```bash
npm run typecheck && npm run build
npm test
npm run test:contracts
```

With the dev server running (`npm run dev`), optional API checks:

```bash
# Full clone rebuild (requires GitLab + LLM)
curl -X POST http://localhost:3000/api/agent/rebuild \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","projectName":"smoke-test","validateBuild":true}'

# Scratch plan
curl -X POST http://localhost:3000/api/agent/propose-website-plan \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Example Co","industry":"cleaning","location":"Austin, TX","services":"standard cleaning","targetCustomers":"families","mainGoal":"get leads","phone":"512-555-0100","email":"hello@example.com","address":"","desiredStyle":"professional","notes":""}'
```

Expected: `ok: true`, build validation passes when `validateBuild: true`, GitLab/Vercel steps succeed when tokens are configured.

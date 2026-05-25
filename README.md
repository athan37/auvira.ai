# AI Website Migration Agent

Turn an outdated business website into a clean Git-backed site, then maintain it through chat.

## How It Works

### Two Product Modes

**1. Clone existing website**
Paste a URL → system crawls it → generates a fresh Next.js site → commits to GitLab → deploys to Vercel.

**2. Create from scratch**
Fill in a short form → system writes a website plan → builds and deploys the site.

### Architecture

The LLM only generates JSON data (business info, section copy, colors). It never generates code. A static React template reads from `siteConfig.ts` to render the page. Every generated site passes a local build validation before it is committed or deployed — broken code never reaches Vercel.

### Reliability

- **Build gate**: All generated sites are built with `npm run build` in a temp directory. Only successful builds are committed to GitLab and deployed to Vercel.
- **Vercel readiness polling**: The UI polls for deployment status every 5 seconds. "Open Live Site" is only enabled once Vercel reports READY, preventing owners from opening 404 URLs.
- **Content fidelity**: Clone mode validates the generated site against extracted facts, blocking hallucinated phone numbers (e.g., 555 prefixes), fake testimonials, and fake awards.

### Owner Loop

After deployment, the owner can chat to update the site — "Add pricing section", "Update phone number", "Make it more premium". Each edit runs the build gate before commit; if validation fails, the previous live site stays unchanged. **Publish live site** saves a backup copy to GitLab, then updates the public URL on Vercel (SHA-pinned deploy; live badge shows **Live** only when the deployment matches your backup).

#### Owner-facing UI (dashboard → editor)

| Step             | What owners see                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard**    | Getting-started checklist; **In progress** clone jobs with **Continue setup**; **New from URL** or **Start without a URL**                                                     |
| **Clone wizard** | Phase progress (bar stays below 100% until publish completes); **Pick a look** template gallery before **Build Preview**; unified **Save backup copy** / **Publish live site** |
| **Editor**       | Draft preview (left); Chat / Changes / **Publish** tabs; sticky **Publish live** when there are unpublished edits; plain status (**Live**, **Updating live site…**)            |

**Language:** Primary actions avoid GitLab/Vercel jargon — use **backup copy**, **draft preview**, and **live website**. Advanced links to the GitLab repo are optional.

**Failed edits:** Chat suggests opening the **Changes** tab; the UI auto-switches there on failure so owners can review files or undo.

#### Product catalog (Phase 2)

Owners can add products under **Publish → Product catalog** in the project editor. Products are stored in MongoDB (`Product` model, scoped by `projectId`). **Add products to draft preview** merges a product grid into `src/lib/siteConfig.ts` in the local workspace; **Publish live site** deploys that draft.

- `GET/POST /api/projects/[projectId]/catalog` — list / create products
- `POST /api/projects/[projectId]/catalog/sync` — inject catalog into draft `siteConfig`

Sites remain static export (`output: 'export'`); listings use inquiry CTAs or external product links, not native checkout.

#### Commerce (Phase 3 — not enabled by default)

Online checkout is planned via Stripe Payment Links or an embed (Shopify/Woo). Configuration stub: set `STRIPE_CHECKOUT_ENABLED=true` and `STRIPE_SECRET_KEY` when implementing checkout (`src/lib/commerce/stripeConfig.ts`). Until then, use catalog + contact CTAs.

#### Regression: deploy consistency

```bash
npx tsx scripts/e2e-deploy-verify.ts --project-id <id>
```

Verifies GitLab commit visibility, SHA-pinned Vercel deploy, and production HTML match. Recommended in CI after infra changes.

### Stack

- Next.js 14 + Tailwind CSS + TypeScript
- GitLab (code storage for generated customer sites)
- Vercel (hosting for this app and customer sites)
- Local LLM proxy (any OpenAI-compatible API)

## CI/CD (GitHub + Vercel)

**GitHub** runs CI on every push/PR to `main` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)): `typecheck` → `test` → `build`.

**Vercel** deploys the app when you connect the GitHub repo (do not also run `vercel deploy` from Actions or you will double-deploy).

### One-time Vercel setup

1. [Vercel](https://vercel.com) → **Add Project** → import `athan37/la-mue-site-builder`.
2. **Production Branch:** `main` (pushes to `main` deploy production; other branches get Preview URLs if enabled).
3. **Environment variables** (Production + Preview): `MONGODB_URI`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, GitLab, MiniMax, etc. **You do not need** `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` on Vercel — Auth.js detects the host when `VERCEL=1` (set automatically), and `next.config.js` sets `NEXT_PUBLIC_APP_URL` from `VERCEL_URL` at build time. Override only if you use a custom domain. Optional customer-site deploys: `SITE_AGENT_VERCEL_TOKEN`.
4. After first deploy, add your Vercel URL to **Google OAuth** redirect URIs: `https://<your-domain>/api/auth/callback/google` (this step cannot be fully automated).
5. Push to `main` and confirm a deployment appears under Vercel → **Deployments**.

### Vercel Sandbox dev preview (production editor)

When this app runs on Vercel (`VERCEL=1`), owner projects use [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) for a local-like preview: `git clone` → `npm install` → `npm run dev` in an isolated VM (~30 minutes per session). Chat edits run on the **same filesystem** as the dev server.

- **Enable:** default on Vercel; set `SITE_AGENT_SANDBOX_ENABLED=0` to fall back to the published live URL iframe.
- **Auth:** Vercel OIDC on deployments (recommended) or `vercel env pull` token for local SDK testing.
- **TTL:** `SITE_AGENT_SANDBOX_TIMEOUT` (default `30m`), aligned with scratch release on editor leave.
- **Local dev:** unchanged — still uses scratch disk + `/api/.../preview/proxy` (no Sandbox).

See `docs/VERCEL_SANDBOX_IMPLEMENTATION.md` for architecture and rollout notes.

### Optional: require CI before merge

GitHub → **Settings** → **Branches** → protect `main` → require status check **CI**.

1. Enter an existing small-business website URL
2. The system crawls the website and extracts business info using your local LLM proxy
3. Generates a modern one-page Next.js/Tailwind website
4. Creates a GitLab repo and commits the generated files
5. Supports follow-up edits like "add FAQ" or "add booking button"

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

- `GITLAB_TOKEN`: Your GitLab personal access token
- `GITLAB_GROUP_ID`: The ID of your GitLab group where projects will be created
- `SITE_AGENT_VERCEL_TOKEN`: Optional — Vercel API token so the app can create/deploy **customer** sites (not required to host this app on Vercel)
- `SITE_AGENT_VERCEL_TEAM_ID`: Optional team ID if your token is team-scoped

### 3. Configure MiniMax API

Set in `.env.local` (see `.env.example`):

| Variable          | Example                                        |
| ----------------- | ---------------------------------------------- |
| `LLM_PROVIDER`    | `minimax` (default — direct API)               |
| `MINIMAX_API_KEY` | `sk-cp-...`                                    |
| `MINIMAX_API_URL` | `https://api.minimax.io/anthropic/v1/messages` |
| `MINIMAX_MODEL`   | `MiniMax-M2.7-highspeed`                       |

**Optional:** use a local proxy instead (`LLM_PROVIDER=minimax-proxy`, `MINIMAX_PROXY_URL=http://localhost:3457/minimax-json`).

### 4. Create GitLab Token

1. Go to GitLab → Settings → Access Tokens
2. Create a token with these scopes:
   - `api`
   - `read_user`
   - `read_repository`
   - `write_repository`
3. Copy the token to `GITLAB_TOKEN` in `.env.local`

### 5. Find GitLab Group ID

1. Go to your GitLab group
2. The group ID is in the URL: `https://gitlab.com/groups/<group-name>/-/groups/<group-id>`
3. Or use the GitLab API: `GET /groups/:group_path`

### 6. Optional: Configure Vercel for Live Preview

Vercel integration enables automatic deployment to a live URL. Without it, you can still use the GitLab repo.

1. **Create Vercel Token:**
   - Go to https://vercel.com/account/tokens
   - Create a new token with scope `full` or `deployments`
   - Add `SITE_AGENT_VERCEL_TOKEN` to `.env.local` (optional; legacy `VERCEL_API_TOKEN` / `VERCEL_TOKEN` still work locally)

2. **Find Vercel Team ID (if using a team):**
   - Go to https://vercel.com/account/teams
   - Your team ID is in the team settings URL
   - Add `SITE_AGENT_VERCEL_TEAM_ID` to `.env.local` only if using a team-scoped token (optional)

3. **Note:** Vercel will automatically import the GitLab repo and deploy. First deploy may take 1-3 minutes.

### 7. Run the app

```bash
npm run dev
```

Visit http://localhost:3000

### 8. Enable owner website edits (TypeScript agent)

After a project is saved to GitLab, edits on `/projects/[projectId]` use the **TypeScript WebsiteEditAgent** in [`src/lib/project-workspace/website-edit-agent/`](src/lib/project-workspace/website-edit-agent/):

- **Router** picks single-shot (fast) vs tool loop (complex edits)
- **Single-shot** for simple style/color requests (direct MiniMax API)
- **Tool loop** for sections, copy, and repo-wide changes (requires `rg` on PATH)

Clone-job preview-chat on `/clone/jobs/[id]` is a separate flow.

**1. Set `MINIMAX_API_KEY`** (and optional `MINIMAX_MODEL`).

**2. Start Next.js:**

```bash
npm run dev
```

| Variable                    | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `LLM_PROVIDER`              | `minimax` (default), `minimax-proxy`, or `gemini`  |
| `WEBSITE_EDIT_LLM_PROVIDER` | Optional: set to `gemini` for agent tool-loop only |

**Troubleshooting**

| Symptom                       | Fix                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- |
| `No files were changed`       | Retry; for complex edits be more specific                              |
| `I had trouble understanding` | MiniMax JSON failed twice — try `WEBSITE_EDIT_LLM_PROVIDER=gemini`     |
| Preview 503                   | Restart page; preview dev server may be hung (see workspace bootstrap) |

## Test API Endpoints

### 1. LLM Generate JSON

```bash
curl -X POST http://localhost:3000/api/llm/generate-json \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Return a simple JSON object with a greeting message",
    "schema": {
      "type": "object",
      "properties": {
        "message": { "type": "string" }
      },
      "required": ["message"]
    }
  }'
```

### 2. GitLab Create Project

```bash
curl -X POST http://localhost:3000/api/gitlab/test-create-project \
  -H "Content-Type: application/json" \
  -d '{"name": "demo-generated-site"}'
```

### 3. Agent Rebuild (Full Flow)

```bash
curl -X POST http://localhost:3000/api/agent/rebuild \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "instruction": "Make it modern and clean",
    "projectName": "my-test-site"
  }'
```

Response includes:

- `stageLogs`: array of stage entries with timestamps and durations
- `duration_ms`: total elapsed time
- `businessProfile`: extracted business info
- `siteSpec`: generated site specification
- `gitlab.projectId`, `gitlab.repoUrl`: created GitLab project info
- `deployment.status`: "project_created", "failed", or "pending"
- `deployment.liveUrl`: live Vercel URL if successful
- `deployment.note`: status message or fallback instructions

### 4. Vercel Create Project (Test)

```bash
curl -X POST http://localhost:3000/api/vercel/test-create-project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-vercel-site",
    "gitlabProjectId": 12345678,
    "gitlabRepoUrl": "https://gitlab.com/group/project.git",
    "gitlabPathWithNamespace": "group/project"
  }'
```

### 5. Agent Edit

```bash
curl -X POST http://localhost:3000/api/agent/edit \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 12345678,
    "siteSpec": {
      "siteTitle": "My Business",
      "tagline": "Serving since 2020",
      "primaryCTA": "Get Started",
      "secondaryCTA": "Learn More",
      "sections": [
        { "type": "hero", "title": "", "body": "", "items": [] },
        { "type": "services", "title": "Services", "body": "", "items": [] }
      ],
      "designDirection": { "tone": "", "layout": "", "colors": [] }
    },
    "editRequest": "Add a booking section to the homepage"
  }'
```

Response includes:

- `stageLogs`: array of stage entries with timestamps and durations
- `duration_ms`: total elapsed time
- `updatedSiteSpec`: the modified site specification
- `summaryOfChanges`: list of changes made

## Known MVP Limitations

---

## Authentication & Multi-Project Support

### Overview

NextAuth (Auth.js) with Google OAuth provides authentication. MongoDB stores user accounts, website projects, chat history, and action logs. Each logged-in user owns their own projects — the API enforces owner-gated access on every endpoint.

### Environment Variables

```bash
# MongoDB (required for auth)
MONGODB_URI=mongodb://localhost:27017/ai-website-migration

# NextAuth (required for auth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/providers/google` as an authorized redirect URI
4. Add `http://localhost:3000` as an authorized JavaScript origin
5. Copy Client ID and Client Secret to `.env.local`

### API Endpoints

| Method | Endpoint                                           | Description                                  |
| ------ | -------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/projects`                                    | List all projects for the authenticated user |
| GET    | `/api/projects/[projectId]`                        | Get a single project (owner-gated)           |
| POST   | `/api/projects/clone`                              | Clone a URL and save as a project            |
| POST   | `/api/projects/scratch/propose`                    | Generate a website plan (no DB save)         |
| POST   | `/api/projects/scratch/build`                      | Build from plan and save as project          |
| POST   | `/api/projects/[projectId]/code-agent/edit/stream` | Owner website edit (SSE)                     |
| GET    | `/api/projects/[projectId]/messages`               | Get chat history                             |
| GET    | `/api/projects/[projectId]/deployment-status`      | Poll Vercel deployment status                |

### Key Design Decisions

- **Backend-owned metadata**: Frontend only sends `projectId` + `message` for chat edits. siteSpec, GitLab projectId, and Vercel metadata are all loaded from MongoDB by the backend.
- **Owner-gated access**: Every project API filters by `ownerId` from the auth session. Attempting to access another user's project returns 404.
- **Fail-safe edits**: If the build gate fails on a chat edit, the previous site stays live and unchanged — no broken code is ever committed.
- **Existing routes preserved**: `/api/agent/rebuild`, `/api/agent/edit`, `/api/agent/build-from-plan` remain functional as smoke tests and fallbacks.

### Frontend Pages

- `/auth/signin` — Google sign-in page
- `/dashboard` — Project list with auth-gated access (redirects to sign-in if not authenticated)
- `/projects/[projectId]` — Per-project workspace with website preview, deployment status, and chat

---

## Smoke Tests

### Main App Build

```bash
npm run build
```

Expected: Build completes without errors.

### Clone Route Smoke Test

```bash
curl -X POST http://localhost:3000/api/agent/rebuild \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.lindseylewislaw.com/",
    "projectName": "clone-smoke-test",
    "validateBuild": true
  }'
```

Expected:

- `ok: true`
- `generatedSiteValidation.ok: true`
- `contentFidelity.passed: true`
- `deployment.status: "triggered"`

### Scratch Plan Route Smoke Test

```bash
curl -X POST http://localhost:3000/api/agent/propose-website-plan \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Bayou Bright Cleaning",
    "industry": "home cleaning",
    "location": "Houston, TX",
    "services": "standard cleaning, deep cleaning, move-in move-out cleaning",
    "targetCustomers": "busy families and apartment renters",
    "mainGoal": "get leads",
    "phone": "512-555-9999",
    "email": "hello@bayoubrightcleaning.com",
    "address": "",
    "desiredStyle": "friendly local but professional",
    "notes": "I want people to request a quote online."
  }'
```

Expected:

- `ok: true`
- `websitePlan` exists
- `phone: "512-555-9999"` is not blocked (512-555 is a real Austin exchange)
- No fake testimonials or awards in plan

### Scratch Build Route Smoke Test

```bash
curl -X POST http://localhost:3000/api/agent/build-from-plan \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "scratch-smoke-test",
    "validateBuild": true,
    "websitePlan": {
      "businessName": "Bayou Bright Cleaning",
      "industry": "home cleaning",
      "positioning": "Bayou Bright Cleaning provides professional home cleaning services in Houston TX.",
      "targetCustomers": ["busy families"],
      "primaryGoal": "get leads",
      "contentPlan": {
        "hero": {
          "headline": "Houston Trusted Home Cleaning Experts",
          "subheadline": "Professional cleaning for busy families",
          "primaryCTA": "Get a Free Quote",
          "secondaryCTA": "View Services"
        },
        "sections": [
          {"type": "services", "title": "Our Services", "purpose": "Detail cleaning services", "contentNotes": ["Standard Cleaning", "Deep Cleaning", "Move-in/Move-out"]}
        ]
      }
    }
  }'
```

Expected:

- `ok: true`
- `mode: "scratch"`
- `generatedSiteValidation.ok: true`
- `scratchValidation.ok: true`
- GitLab repo created
- Vercel deployment triggered

### Deployment Status Smoke Test

```bash
curl "http://localhost:3000/api/projects/YOUR_PROJECT_ID/deployment-status"
```

Expected:

- `ok: true`
- `status: "ready" | "building" | "pending" | "failed"`
- `commitVerified: true` only when the live Vercel build matches the commit you just deployed
- `liveUrl` is the **production** URL (`https://your-project.vercel.app`), not a one-off preview URL

### Deploy consistency (preview → GitLab → Vercel)

When you click **Deploy to Vercel** on a project:

1. **Full preview sync** — every publishable file in the local workspace is pushed to GitLab (force sync).
2. **GitLab propagation** — deploy waits until that commit SHA is visible on GitLab (fails if not within 30s).
3. **SHA-pinned Vercel build** — Vercel is asked to build that exact commit (not an unpinned deploy hook).
4. **Verified live link** — the UI shows **Live** only when Vercel reports READY **and** the deployment matches your commit SHA.
5. **Production URL** — use `https://{vercelProjectName}.vercel.app`. Links like `…-kb5bda2hh-…-athan37s-projects.vercel.app` are frozen deployment snapshots and do not update when you redeploy.

**Save to GitLab** backs up changes without publishing. **Deploy** always syncs the full preview first, then publishes.

---

## Generated Site Reliability

Every generated website must pass a local build validation before it is committed to GitLab or deployed to Vercel.

### Architecture Rules

The LLM only generates JSON data:

- `factualSiteData` — strictly extracted facts from the crawled site
- `siteSpec` — section titles, body copy, items, CTAs
- `designBrief` — color palette, typography, layout enum values

The LLM never generates:

- React code or components
- Tailwind class strings
- CSS or imports
- `package.json`, Next.js config, or Tailwind config
- arbitrary code

All actual code comes from `templates.ts` — deterministic, pre-audited templates chosen by enum values.

### Build Gate Flow

1. **Generate files** — `generateWebsiteFiles()` renders the template with siteSpec data
2. **Write to temp** — Files written to `.tmp/generated-sites/<project>-<timestamp>/`
3. **Check required files** — package.json, next.config.js, tailwind.config.js, postcss.config.js, tsconfig.json, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/lib/siteConfig.ts, README.md
4. **Static validation** — Scan for unsafe patterns in page.tsx and siteConfig.ts:
   - Blocked: `\${`, `${escapedSiteSpec}`, `process.env`, `require(`, `dangerouslySetInnerHTML`, `@/lib/agent`, `contact@example`, `(555)`, `Sterling Immigration Law`
   - Required: `export default function Home` in page.tsx, `export const siteConfig` in siteConfig.ts
5. **Run npm build** — `npm install --silent && npm run build` with NODE_ENV=production, 90s timeout
6. **Commit gate** — Only if build exits 0: create GitLab repo → commit files → trigger Vercel deploy

### Fail-Fast Behavior

If the build gate fails:

- No GitLab project is created
- No code is committed
- No Vercel deployment is triggered
- Error is returned with validation logs

This keeps broken code from ever reaching Vercel, which cannot be undeployed.

### Chat Edit Safety

The same build gate protects chat edits:

- After an edit request, `validateGeneratedSite()` runs on the updated files
- Only if validation passes does the commit happen
- If validation fails, the previous live website stays safe and unchanged

### `.tmp` Directory

Validated build artifacts are written to `.tmp/generated-sites/`. This directory is gitignored and never committed.

### Build Validation Request Parameter

```bash
curl -X POST http://localhost:3000/api/agent/rebuild \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "projectName": "my-site",
    "validateBuild": true   # default: true, set false for quick local experiments
  }'
```

---

## Live Preview via Vercel

After rebuild, if `SITE_AGENT_VERCEL_TOKEN` is configured, the system:

1. Creates a Vercel project connected to your GitLab repo
2. Creates a deploy hook for the main branch
3. Triggers the deployment automatically

### How It Works

1. After GitLab commit, `createVercelProject()` is called with GitLab repo info
2. Vercel API creates a new project with GitLab as the git source
3. **SSO protection is disabled** via `PATCH /v2/projects/:id` so the deployment is publicly accessible
4. A deploy hook is created via `POST /v2/projects/:id/deploy-hooks`
5. The deploy hook URL is called to trigger the first deployment
6. Vercel clones the GitLab repo, runs `npm install && npm run build`, and deploys

### Deployment Status

Response includes `deployment.status`:

- `"triggered"` — Deploy hook created and triggered successfully
- `"trigger_failed"` — Deploy hook was created but triggering failed
- `"failed"` — Vercel project creation itself failed

### If Deployment Does Not Start

**Check Vercel dashboard:**

1. Go to `deployment.projectUrl` (shown in response)
2. Check if deployment appears under "Deployments" tab
3. If not, click "Create Deployments" or push a new commit

**Common issues:**

- **Deploy hook 404**: The hook ID returned by Vercel API was malformed. Solution: delete the project and retry.
- **Deploy hook returns error**: The git credential may be invalid. Reconnect GitLab in Vercel dashboard.
- **Project created but no deployment**: Vercel requires a git push or manual trigger for first deployment.

**Manual trigger via API:**

```bash
# Get deploy hook URL from project
curl -s "https://api.vercel.com/v2/projects/<projectId>" \
  -H "Authorization: Bearer $SITE_AGENT_VERCEL_TOKEN" | jq '.link.deployHooks[-1].url'

# Trigger deployment
curl -X POST "<deploy-hook-url>" \
  -H "Authorization: Bearer $SITE_AGENT_VERCEL_TOKEN"
```

**Manual Vercel Import:**

1. Go to https://vercel.com/import/git
2. Paste your GitLab repo URL: `https://gitlab.com/<namespace>/<project>.git`
3. Vercel will auto-detect Next.js and deploy

### Vercel API Fallback

If you don't have `SITE_AGENT_VERCEL_TOKEN`, the GitLab repo is still created. You can always manually import the repo URL into Vercel.

## Deployment Readiness Tracking

Vercel deployments are triggered asynchronously. After rebuild, the API returns immediately while Vercel is still building. The live URL may show 404 until Vercel finishes.

### How It Works

1. Rebuild triggers GitLab commit → then calls `createVercelProject()`
2. Vercel project is created, deploy hook is triggered
3. API response includes `deployment.status = "triggered"` and `deployment.triggeredAt`
4. Frontend starts polling `GET /api/vercel/deployment-status?projectName=...&since=...`
5. Polling runs every 5 seconds for up to 3 minutes
6. UI shows: Pending → Building → Ready (or Failed)

### Deployment Status States

- **pending** — Triggered but Vercel has not created a deployment record yet
- **building** — Vercel is building (QUEUED, INITIALIZING, BUILDING)
- **ready** — Deployment is live (READY state)
- **failed** — Deployment failed or was canceled (ERROR, CANCELED)

### UI Behavior

The `DeploymentStatusCard` component shows in the bottom-right corner of the workspace:

- **Not ready**: "Open Live Site" button is disabled/grayed, shows warning about 404
- **Ready**: "Open Live Site" button is enabled and green

### Manual Status Check

```bash
curl "http://localhost:3000/api/vercel/deployment-status?projectName=clone-lindsey-lewis-test-afyc2d-ol3e&since=2026-05-18T00:02:08Z"
```

Response:

```json
{
  "ok": true,
  "status": "ready",
  "vercelState": "READY",
  "deploymentId": "dpl_xxxxx",
  "deploymentUrl": "https://clone-lindsey-lewis-test-afyc2d-ol3e.vercel.app",
  "inspectorUrl": "https://vercel.com/dashboard/deployments/dpl_xxxxx",
  "createdAt": 1779062652387,
  "readyAt": 1779062680000,
  "projectName": "clone-lindsey-lewis-test-afyc2d-ol3e",
  "message": "Your website is live."
}
```

### Troubleshooting

**Vercel deployment returns 404 after rebuild:**

- Wait 1-3 minutes — Vercel may still be building
- Check deployment status at `deployment.projectUrl`
- If status is `trigger_failed`, the deploy hook was created but trigger failed — manually trigger via Vercel dashboard

**Deploy hook creation failed (trigger_failed status):**

- This is non-fatal — the Vercel project is still created
- Go to Vercel dashboard and click "Create Deployments" or push a new commit
- Or use the manual trigger via API shown above

**GitLab Pages URL returns 404:**

- Check that the pipeline passed (CI/CD → Pipelines)
- Ensure the project is public or Pages is enabled
- Wait 1-2 minutes after pipeline completion

**Pipeline failed:**

- Check the pipeline log for build errors
- Common issue: `next build` may have TypeScript errors in generated code
- Verify `package.json` has `"build": "next build"` script

---

## Website Maintenance Chat

After rebuilding a website, the owner can maintain and update their site through a chat interface.

### How It Works

1. **After rebuild**, the generated site state is saved in browser localStorage (`ai-website-agent-current-site`):
   - projectId, repoUrl, liveUrl
   - siteSpec (current website structure)
   - businessProfile (business info)
   - lastUpdated timestamp

2. **Maintenance chat** appears below the rebuild section:
   - Owner can type natural language requests: "Add FAQ section", "Update phone number", "Make it more premium"
   - Quick action buttons for common edits
   - Chat history is persisted in localStorage (`ai-website-agent-chat-history`)

3. **On each edit**:
   - Frontend calls `POST /api/agent/edit` with projectId, siteSpec, and editRequest
   - Backend updates siteSpec via LLM
   - Backend regenerates files and commits to GitLab
   - Backend triggers Vercel redeploy via deploy hook
   - Frontend updates localStorage with new siteSpec

4. **Vercel redeploys** automatically from GitLab connection:
   - After GitLab commit, Vercel detects the push and starts a new deployment
   - Or the deploy hook is triggered directly
   - Takes 1-3 minutes for the new version to go live

### Supported Edits

**Simple content updates:**

- Add/update FAQ, pricing, booking CTA, testimonials
- Update contact info, phone, hours, address
- Change tone or improve CTAs
- Add services or rewrite copy
- Make site look more premium

**Complex features (placeholder only):**

- Booking backend, login, payments, CRM, inventory
- These add a placeholder CTA section with note that full integration is not implemented in MVP

### Persistence

- **localStorage only** — no database, cleared if user clears browser cache
- Chat history persists across sessions
- Each new rebuild creates a new site state (old site still accessible via GitLab)

### Constraints

- No auth, database, or backend integration in MVP
- Real booking/payment/login are placeholders only
- Owner must have access to the GitLab account that owns the project

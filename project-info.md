---
name: project-info
description: MongoDB database name, key API routes, CloneJob status flow
type: reference
---

# Project Info

**MongoDB database:** `test` (not `Cluster0`)

**CloneJob statuses:** `queued` → `crawling` → `extracting` → `planning` → `review_ready` → `building` → `deploying` → `completed` | `failed`

**Key API routes:**
- `GET /api/projects/clone/jobs/[jobId]` — poll job status, check Vercel (polling guard uses `vercelProjectId || vercelProjectName`)
- `POST /api/projects/clone/jobs/[jobId]/approve` — approve plan
- `POST /api/projects/clone/jobs/[jobId]/process-build` — start build
- `POST /api/projects/clone/jobs/[jobId]/revise-plan` — revise plan

**Vercel deployment polling bug:** Fixed — guard changed from `job.deployment?.vercelProjectId` to `job.deployment?.vercelProjectId || job.deployment?.vercelProjectName`. Vercel's `projectId` param is internal numeric ID, not URL slug — use `projectName` fallback.

**Build steps:** `generate_site_spec` → `generate_files` → `validate_build` → `create_gitlab_project` → `commit_files` → `create_vercel_project` → `trigger_deployment` → `wait_for_vercel`
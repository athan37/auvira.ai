# Agent & developer guide

Instructions for AI agents and contributors working in this repo.

## Local credentials for testing

**All keys needed to run tests and integrations live in local env files — never in the repo.**

1. Copy [`.env.example`](.env.example) to **`.env`** (used by `npm run test:*` via `node --env-file=.env`) and/or **`.env.local`** (used by Next.js dev).
2. Fill in at minimum:
   - **`MINIMAX_API_KEY`** — required for live LLM / planner / edit-agent tests
   - **`MONGODB_URI`**, **`AUTH_SECRET`** / **`NEXTAUTH_SECRET`** — required for `next build` and auth-related paths
   - GitLab / Google OAuth / Vercel tokens as needed for the workflow you are testing

Do **not** commit `.env` or `.env.local`. Do **not** read or paste secret values into chat or PRs.

## Testing strategy

| Tier | Command | When |
|------|---------|------|
| Fast deterministic | `npm run test:contracts` | Section color pipeline, classifier, strategy, synthetic fixtures (~1s) |
| Full unit (no LLM) | `npm test` | CI default; excludes `*.llm.test.ts` (~5–15s) |
| **Live LLM integration** | `npm run test:llm` | **Run before merge** for edit-agent / planner changes (~85+ tests) |
| LLM edit-error suite | `npm run test:llm:edit-errors` | Copy, structural, planner guardrails (~14 cases) |
| LLM smoke (contracts) | `npm run test:llm:contracts` | Section-color contract smoke (3 cases) |
| Everything | `npm run test:all` | **Final gate** — unit + full LLM suite + LLM contract smoke |

**For best results on agent/edit work, always run LLM integration tests locally** when `.env` has a valid `MINIMAX_API_KEY`. Unit and contract tests catch regressions in wiring and invariants; they do **not** replace live planner/routing behavior.

LLM suites are gated by `VITEST_LLM_SUITE=1` (set automatically on `test:llm*` scripts). Default `npm test` skips them so CI stays fast and key-free.

When running live LLM suites, Vitest retries failed tests **2 times** by default (3 attempts total). Override with `VITEST_LLM_RETRY=0` to disable or `VITEST_LLM_RETRY=3` for more tolerance.

## Final test gate (required)

**Before merge, push, or marking agent/edit work complete**, run the full suite:

```bash
npm run test:all
```

`test:all` runs, in order:

1. `npm test` — full unit suite (excludes `*.llm.test.ts`)
2. `npm run test:llm` — live planner + edit-agent integration (catalog, gradients, copy, structural, report accuracy)
3. `npm run test:llm:contracts` — LLM section-color contract smoke (3 cases)

Do **not** treat `npm test` or `test:contracts` alone as sufficient for merge when touching the edit agent, planner, routing, or site mutations. Use faster tiers (`test:contracts`, `test:llm:contracts`) during iteration; **`test:all` is the final gate**.

When types or build paths change, also run:

```bash
npm run typecheck && npm run build
```

## Iterative checklist (edit agent / section color)

Use while developing; finish with `test:all` above:

```bash
npm run test:contracts          # fast deterministic (~1s)
npm run test:llm:contracts      # quick LLM smoke
npm run test:llm                # full planner + E2E (routing/classifier changes)
npm run typecheck && npm run build
npm run test:all                # final gate before merge/push
```

## Branch / PR conventions

- Prefer synthetic contract tests (`tests/support/syntheticSiteWorkspace.ts`) over site-specific fixtures (Jobber, Loop Co, etc.) except frozen regressions.
- Do not merge agent pipeline changes without contract + at least LLM smoke passing locally.
- Production deploys come from `main`; preview deploys from PR branches.

## Key paths

| Area | Path |
|------|------|
| Unified section color pipeline | `src/lib/project-workspace/sectionPresentationEdit.ts` |
| Edit agent (GitLab required) | `src/lib/project-workspace/edit-agent/index.ts` |
| Edit runner | `src/lib/project-workspace/websiteEditRunner.ts` |
| Legacy project purge | `scripts/purge-non-gitlab-projects.ts` |
| siteConfig mutations | `src/lib/project-workspace/siteConfigMutations.ts` |
| Edit run snapshot / rollback | `src/lib/project-workspace/editRunSnapshot.ts` |
| Shared edit utilities | `src/lib/project-workspace/edit-shared/` (catalog, attachments, toolRegistry) |
| Synthetic test harness | `tests/support/syntheticSiteWorkspace.ts`, `tests/support/sectionColorEditContract.ts`, `tests/support/llmEditScenario.ts` |
| LLM edit-error suites | `tests/edit-agent/copyEdit.llm.test.ts`, `structuralEdit.llm.test.ts`, `plannerGuards.llm.test.ts`, `reportAccuracy.llm.test.ts` |
| LLM test gate | `tests/llmTestGate.ts` |

## Preview section drag-to-chat

Users pin a section target by **dragging a section from the editable preview iframe onto the chat sidebar**. The pinned section is sent as `selectedTarget` on each edit POST (see `docs/EDIT_AGENT.md`).

| Area | Path |
|------|------|
| Bridge script (served externally) | `src/lib/preview/sectionBridgeScript.ts` |
| Proxy HTML injection | `src/lib/preview/injectPreviewSectionSelection.ts`, `src/lib/project-workspace/previewProxyRewrite.ts` |
| Parent drag overlay + drop zone | `src/app/projects/[projectId]/page.tsx` |
| postMessage protocol | `src/lib/preview/sectionSelectionProtocol.ts` |
| Drag target preview thumbnails | `src/lib/preview/capturePreviewRoot.ts`, `src/lib/preview/targetPreviewThumbnail.ts`, `src/components/project/PreviewTargetThumbnail.tsx` |
| Section DOM attrs on generated sites | `src/lib/builder/siteSectionDomAttrs.ts`, `src/lib/analytics/generated-sites/injectAnalyticsRuntime.ts` |

**Editable preview only** — `previewMode === 'live'` loads the published site directly with no proxy injection; drag is disabled by design.

### Problems fixed (why drag initially failed)

1. **Gzip HTML skipped injection** — The workspace preview proxy received compressed HTML, so `injectPreviewSectionSelection` could not find `</head>`. Fix: request `Accept-Encoding: identity` in `previewProxyHandler.ts` and track injection as a rewrite even when asset paths are unchanged.
2. **Inline script blocked by CSP** — Inline bridge scripts were blocked in some preview contexts. Fix: serve the bridge from `/api/projects/[projectId]/preview/section-bridge` and inject a `<script src="…">` tag (versioned query param busts cache).
3. **Cross-iframe mouse events** — After mousedown inside the iframe, the parent window did not reliably receive `mousemove`/`mouseup`. Fix: on `SITE_SECTION_DRAG_START`, show a full-screen capture overlay in `page.tsx` that tracks pointer until drop.
4. **Missing section attrs on legacy workspaces** — Older clones lacked `data-site-section-id`. Fix: bridge falls back to any `<section>` / known `id`, and workspace repair runs `instrumentGeneratedSite` to add attrs.

After bridge changes, **hard-refresh the preview** (toolbar refresh) so proxied HTML picks up the new `section-bridge?v=` version (currently v25 — drag thumbnails are fixed 112×80px with scale-to-fit content).

**Universal drag (v22+):** Any visible link, button, heading, or paragraph inside a section (or nav CTA / business name) can be dragged to chat. Legacy clones without `SITE_ELEMENT_ATTRS` get runtime bootstrap in the bridge; unannotated clicks infer a leaf pin with visible text as the label.

**Element preview (v25):** All styled captures render into a **112×80px** canvas (`TARGET_PREVIEW_THUMB_WIDTH/HEIGHT`); text and controls are **scaled down to fit** so the chip shows the full label (e.g. “Contact Information”), not a cropped slice. UI uses `object-contain`.

### Drag target preview thumbnails

On drag past threshold, the bridge rasterizes the pinned element/card and posts `SITE_SECTION_PREVIEW_THUMB` to the parent. The drag ghost and pinned chip show the thumbnail; on chat drop it uploads via `upload-assets` and persists `previewThumbnail.previewUrl` on `metadata.selectedTarget` in chat history. Live published preview has no bridge — text breadcrumb only.

### Chat history persistence

When a user sends a message with a dragged section pinned, `metadata.selectedTarget` is stored on the user `ProjectMessage` document (same shape as the edit POST body). The chat UI renders a read-only section badge **above** that user message so edits can be traced later.

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

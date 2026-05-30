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
| **Live LLM integration** | `npm run test:llm` | **Run before merge** for edit-agent / planner changes |
| LLM smoke (contracts) | `npm run test:llm:contracts` | 3 synthetic section-color cases on real LLM |
| Everything | `npm run test:all` | Unit + full LLM suite |

**For best results on agent/edit work, always run LLM integration tests locally** when `.env` has a valid `MINIMAX_API_KEY`. Unit and contract tests catch regressions in wiring and invariants; they do **not** replace live planner/routing behavior.

LLM suites are gated by `VITEST_LLM_SUITE=1` (set automatically on `test:llm*` scripts). Default `npm test` skips them so CI stays fast and key-free.

## Recommended pre-merge checklist (edit agent / section color)

```bash
npm run test:contracts
npm run test:llm:contracts    # quick LLM smoke
npm run test:llm              # full planner + E2E integration (when touching routing/classifier)
npm run typecheck && npm run build
```

## Branch / PR conventions

- Prefer synthetic contract tests (`tests/support/syntheticSiteWorkspace.ts`) over site-specific fixtures (Jobber, Loop Co, etc.) except frozen regressions.
- Do not merge agent pipeline changes without contract + at least LLM smoke passing locally.
- Production deploys come from `main`; preview deploys from PR branches.

## Key paths

| Area | Path |
|------|------|
| Unified section color pipeline | `src/lib/project-workspace/sectionPresentationEdit.ts` |
| V1 section style strategy | `src/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy.ts` |
| V3 edit agent (default gitlab) | `src/lib/project-workspace/edit-agent-v3/index.ts` |
| siteConfig mutations | `src/lib/project-workspace/siteConfigMutations.ts` |
| Edit run snapshot / rollback | `src/lib/project-workspace/editRunSnapshot.ts` |
| Edit classifier | `src/lib/project-workspace/website-edit-agent/editJobClassifier.ts` |
| Synthetic test harness | `tests/support/syntheticSiteWorkspace.ts`, `tests/support/sectionColorEditContract.ts` |
| LLM test gate | `tests/llmTestGate.ts` |

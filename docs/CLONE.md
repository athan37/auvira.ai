# Clone pipeline (unified with scratch)

Clone and scratch now share the same build path after intake. Crawl-derived facts become a **WebsitePlan**, then **`buildWebsiteFromPlan`** runs the same pipeline as scratch: validate → `convertPlanToSiteSpec` → design brief → `generateWebsiteFiles` → npm build gate.

## Flow

```
crawlWebsite
  → extractFactualSiteDataAgent
  → businessProfile (LLM)
  → proposeWebsitePlanFromCrawlAgent → WebsitePlan
  → review / revise-plan (warn-only validation)
  → build-preview: buildWebsiteFromPlan
  → validateGeneratedSite (hard gate)
```

## Key modules

| Area | Path |
|------|------|
| Crawl limits (env) | `src/lib/clone/crawlPromptLimits.ts` |
| Crawl prompt input | `src/lib/clone/buildCloneCrawlPromptInput.ts` |
| Plan from crawl | `src/lib/agent/proposeWebsitePlanFromCrawlAgent.ts` |
| Clone intake → scratch | `src/lib/clone/resolveCloneIntake.ts` |
| Review warnings (non-blocking) | `src/lib/agent/validateClonePlanWarnings.ts` |
| Shared build | `src/lib/agent/buildWebsiteFromPlan.ts` |
| Review UI adapter | `src/lib/clone/planReviewAdapter.ts` |
| Legacy SiteSpec shim | `src/lib/clone/normalizeProposedPlan.ts` |

## Validation policy

- **Review stage:** `validateClonePlanWarnings` — amber warnings only; **does not block Build Preview**.
- **Build stage:** `validateScratchContent` + `validateScratchFidelity` (testimonials allowed when crawl extracted them).
- **Deploy gate:** `validateGeneratedSite` (npm build) — only hard stop.

## Env knobs

| Variable | Default |
|----------|---------|
| `CLONE_MAX_PAGES` | 15 |
| `CLONE_MAX_CHARS_PER_PAGE` | 12000 |
| `CLONE_MAX_FACTUAL_CHARS` | 30000 |
| `CLONE_MAX_PLAN_PROMPT_CHARS` | 30000 |
| `CLONE_MAX_PROFILE_PROMPT_CHARS` | 30000 |

## Migration

In-flight jobs storing **SiteSpec** in `proposedWebsitePlan` are converted via `normalizeProposedPlan` / `siteSpecToWebsitePlan` at build-preview time.

## Tests

```bash
npm test -- tests/clone/
npm test -- tests/agent/proposeWebsitePlanFromCrawlAgent.test.ts
```

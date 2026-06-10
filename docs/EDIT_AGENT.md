# Website Edit Agent — Implementation Map

## Entry points

| Layer | Path | Function |
|-------|------|----------|
| HTTP | `src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts` | `POST` → `runWebsiteEdit()` (409 if no GitLab) |
| Runner | `src/lib/project-workspace/websiteEditRunner.ts` | GitLab-only (`agent: 'ts'`) |
| Agent | `src/lib/project-workspace/edit-agent/index.ts` | `runWebsiteEditAgent()` |

## Pipeline

```
buildEditContext → resolveEditTarget → assessEditAmbiguity → resolveImplicitReferences → planEdit → executePlan → domain tools → verify → summarize
```

## Implicit Reference Resolver

Module: [`implicitReferenceResolver.ts`](../src/lib/project-workspace/edit-context/implicitReferenceResolver.ts)

Resolves **vague value references** in the owner message (not section targets) using Site Monitor **`/memory`** (structured slots), `/intent`, `/context`, chat history, LLM phrase extraction, and a guarded LLM resolve fallback.

| Resolves | Does not replace |
|----------|------------------|
| "my favorite color", "brand color", "usual CTA", "same as hero" (style token) | `selectedTarget` / target resolver |
| "my favorite way to edit" (scoped `edit_pattern` from Monitor memory) | Deterministic routing (`buildDeterministicPlan`, explorer) |
| Missing color/copy/CTA when evidence exists | Ambiguity gate (`assessEditAmbiguity`) |
| | Post-edit verification |

**Pipeline:** [`extractImplicitReferences.ts`](../src/lib/project-workspace/edit-context/extractImplicitReferences.ts) (LLM + regex) → [`implicitReferenceResolver.ts`](../src/lib/project-workspace/edit-context/implicitReferenceResolver.ts). Monitor `POST /intent` supplies the authoritative sentence; resolver uses intent + coaching + chat history.

**Order:** runs only after `buildEditContext` succeeds (target + ambiguity gate passed). If the resolver returns `needsClarification`, planning never runs.

**Rules:**

- Explicit values in the message always win (e.g. "make the first section **red**" ignores project favorite color).
- Monitor `/memory` slots ranked by scope (pinned section > section type > project) and kind.
- LLM phrase extract runs only when deictic gate fires (favorite, usual, my way, etc.).
- LLM resolve accepts only `confidence: high` with evidence; otherwise ask-back.
- Monitor unavailable → resolver uses chat history / site config only; edits never fail because of Monitor.

**Examples:**

| Message | Evidence | Outcome |
|---------|----------|---------|
| Pinned section + "background my favorite color" | History/intent mentions blue | Resolve `blue`, annotate `effectiveMessage` |
| Same, no evidence | — | Clarify: "What color should I use?" |
| "make the first section red" | intent has favorite blue | Use **red** (explicit) |
| Pinned CTA + "our usual CTA" | Prior turn set "Book Now" | Resolve CTA text |
| Pinned Contact + "my favorite way to edit" | Monitor `edit_pattern` on `contact` | Resolve style_card pattern |

Planner prompt blocks (when `OBSERVABILITY_COACHING_ENABLED=1`):

1. `## Project vocabulary` — capped keywords/intents from `/intent`
2. `## Project memory` — scoped slots from `/memory` (color, copy, CTA, edit_pattern)
3. `## Resolved user references` — only phrases with concrete `resolvedValue` this turn
4. `## Coaching from prior edits` — existing coaching block

Distinct from [`intentClarifier.ts`](../src/lib/project-workspace/edit-agent/intentClarifier.ts) (explorer field-path pick among section surfaces).

Tests: `tests/edit-context/implicitReferenceResolver.test.ts`, `tests/edit-context/extractImplicitReferences.test.ts`, `tests/edit-agent/implicitReferencePipeline.test.ts`.

## Ambiguity gate (`assessEditAmbiguity`)

Single pre-plan gate in `src/lib/project-workspace/edit-context/assessEditAmbiguity.ts`, called from `buildEditContext` after target resolution and duplicate-copy checks.

| Outcome | When |
|---------|------|
| **Apply** | Target + value are clear — e.g. ordinal section + solid color smart-defaults to section **background** |
| **Clarify** | Unresolved/low target, deictic "this section" without pin, ambiguous style scope (card vs section vs text), copy without new value, compound + low confidence |
| **Zero-change block** | `executePlan` rolls back and returns `needsClarification` if no files changed (never "Updated the page content.") |

`planEdit` skips the LLM when deterministic/explorer paths miss and target confidence is low — returns a clarification plan instead.

### Context vs Tips (UI)

| Surface | When | Content |
|---------|------|---------|
| **GET /context** | Every edit when observability is on | Teal **`/context`** chip — coaching hints, recurring issues, constraints, quality |
| **GET /intent** | Every edit when observability is on | Amber **`/intent`** chip — turn count, keywords, edit types (including empty) |
| **Applied memory** | `outcome === 'success'` and refs resolved | Sky **Memory** chip — `"phrase" → "value"` |
| **Tips** | Clarify/failure local guidance | Violet **Tips** chip |

Each edit snapshots Monitor **`GET /context`** and **`GET /intent`** into chat metadata (`monitorContext`, `intentFeed`) so the UI shows exactly what was fed into the planner/resolver on that request.

Debug: `NEXT_PUBLIC_OBSERVABILITY_DEBUG=1` for Phoenix trace links.

Metadata: `guidanceHints`, `ambiguityReasons` on assistant messages (`projectMessageMetadata.ts`).

Contract tests: `tests/edit-agent/editAmbiguityGate.contract.test.ts`.

## Shared modules (`edit-shared/`)

| Agent consumer | Module |
|----------------|--------|
| Section catalog / targeting | `siteSectionCatalog`, `resolveSectionTarget`, `resolveSectionWithCatalogLLM` |
| Attachment short-circuit | `attachmentRouter` + GitLab image strategies |
| Custom code fallback | `toolRegistry`, `profiles/gitlabNext` via `restrictedFallback` |
| Theme updates | `presetThemeStrategy` via `runStrategyById` |
| Presentation pipeline | `sectionPresentationEdit.ts` |

## Project requirements

- GitLab repo linked and complete (`requireGitLabProject.ts`).
- Unsupported projects (missing/incomplete GitLab, spec editing mode, static workspace path) return **409** on edit/upload.
- Purge stale records via `scripts/purge-non-gitlab-projects.ts`.

## Gaps / future work

- **Unified config copy editing** — see [`UNIFIED_CONFIG_EDIT_PLAN.md`](./UNIFIED_CONFIG_EDIT_PLAN.md) (replace section-type heuristics with ConfigFieldIndex + `resolveConfigTextEdit`)
- `remove_section`, `reorder_sections`, `replace_image` — clarify or stub
- Section-aware gradient from current background color

## Edit focus stack (N-turn memory)

Each successful edit pushes an `EditFocus` item onto `editFocusStack` in assistant message metadata (newest first, cap 5). Deictic follow-ups ("that section", "that image") resolve against this stack via `resolveEditFocus.ts` — not ad-hoc per-intent merge functions.

Load path: `resolveEditFocusFromProject()` in stream route → `WebsiteEditAgentOptions.editFocusStack`.

## Preview section selection (UI pin)

**Drag** a section from the editable preview (proxy mode) onto chat to pin it. Each edit POST may include `selectedTarget`. Target resolution priority:

1. `selectedTarget` from preview (UI pin)
2. Explicit section title/number in the current message
3. `editFocusStack` / deictic ("that section")
4. Section catalog + LLM fallback
5. Clarification

When a target is pinned, `buildEditContext` attaches `selectedTargetContext` with parsed section values and an **EDITABLE FIELDS** list (config field paths + current values). The planner prompt includes `UI-SELECTED TARGET`, `SELECTED TARGET CONTEXT`, and pin rules. Deterministic routing handles high-confidence pinned copy edits (e.g. "change the title to …") via `update_config_field`.

Element-level pins (optional): preview bridge v15+ reads `data-site-element-kind`, `data-site-config-field-path`, and `data-site-item-index` on clicked elements within a section.

**Inner vs outer background:** When the owner names an inner element (`contact information`, `card`, `info panel`), style edits target `presentation.cardClass` on the pinned section — not `presentation.backgroundClass`. The planner context block lists `STYLABLE PRESENTATION TARGETS` to disambiguate.

Contract: `src/lib/project-workspace/edit-shared/selectedTargetTypes.ts` → `resolveSelectedTarget()` + `buildSelectedTargetContext()` in `edit-context/`. Persisted on user chat messages as `metadata.selectedTarget`. Live/cross-origin preview disables selection mode.

## LangGraph — defer unless

| Signal | Action |
|--------|--------|
| Focus stack + tests cover 4–6 turn chains reliably | Stay in-repo (current default) |
| Need pause/resume edit workflow across server restarts | LangGraph checkpointer + Mongo |
| Product wants editable graph / parallel branches | LangGraph StateGraph |
| One orchestration model for edit + build + deploy | Platform-level decision |

LangGraph would sit **above** existing domain tools as a thin orchestrator; do not rewrite presentation or gallery pipelines into graph nodes wholesale.

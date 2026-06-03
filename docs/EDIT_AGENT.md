# Website Edit Agent — Implementation Map

## Entry points

| Layer | Path | Function |
|-------|------|----------|
| HTTP | `src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts` | `POST` → `runWebsiteEdit()` (409 if no GitLab) |
| Runner | `src/lib/project-workspace/websiteEditRunner.ts` | GitLab-only (`agent: 'ts'`) |
| Agent | `src/lib/project-workspace/edit-agent/index.ts` | `runWebsiteEditAgent()` |

## Pipeline

```
buildEditContext → resolveEditTarget → planEdit → executePlan → domain tools → verify → summarize
```

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

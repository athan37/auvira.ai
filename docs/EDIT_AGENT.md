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

- `remove_section`, `reorder_sections`, `replace_image` — clarify or stub
- Section-aware gradient from current background color

## Edit focus stack (N-turn memory)

Each successful edit pushes an `EditFocus` item onto `editFocusStack` in assistant message metadata (newest first, cap 5). Deictic follow-ups ("that section", "that image") resolve against this stack via `resolveEditFocus.ts` — not ad-hoc per-intent merge functions.

Load path: `resolveEditFocusFromProject()` in stream route → `WebsiteEditAgentOptions.editFocusStack`.

## LangGraph — defer unless

| Signal | Action |
|--------|--------|
| Focus stack + tests cover 4–6 turn chains reliably | Stay in-repo (current default) |
| Need pause/resume edit workflow across server restarts | LangGraph checkpointer + Mongo |
| Product wants editable graph / parallel branches | LangGraph StateGraph |
| One orchestration model for edit + build + deploy | Platform-level decision |

LangGraph would sit **above** existing domain tools as a thin orchestrator; do not rewrite presentation or gallery pipelines into graph nodes wholesale.

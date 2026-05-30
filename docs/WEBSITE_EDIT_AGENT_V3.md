# Website Edit Agent V3 — Implementation Map (Phase 0)

## Entry points

| Layer | Path | Function |
|-------|------|----------|
| HTTP | `src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts` | `POST` → `runWebsiteEdit()` |
| Runner | `src/lib/project-workspace/websiteEditRunner.ts` | `WEBSITE_AGENT_V3` > V2 > V1 |
| V3 | `src/lib/project-workspace/edit-agent-v3/index.ts` | `runWebsiteEditAgentV3()` |

## V3 pipeline

```
buildEditContext → resolveEditTarget → planEdit → executePlan → domain tools → verify → summarize
```

## Overlap with legacy

| V3 module | Reuses |
|-----------|--------|
| `edit-context/` | `getSiteModel`, `siteSectionCatalog`, `buildGroundedEditContext` patterns |
| `tools/domain/apply_section_background` | `sectionPresentationEdit.applySectionBackgroundEdit` |
| `tools/domain/update_contact_info` | `siteConfigMutations.updateContactFieldInSource` |
| `planner/planEdit.ts` | Extended in-progress Zod schema |
| `edit-agent-v3/restrictedFallback` | V1 `toolRegistry` (custom_code_edit only) |

## Gaps / future work

- `remove_section`, `reorder_sections`, `replace_image` — clarify or stub
- Static HTML mode — falls back to legacy V1
- Section-aware gradient from current background color

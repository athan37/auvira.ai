# Unified config copy editing — findings & plan

Status: **proposed** (not yet implemented beyond interim fixes)  
Related: [`EDIT_AGENT.md`](./EDIT_AGENT.md), contact regression tests in `tests/edit-agent/contactSectionCopyRegression.test.ts`

---

## Executive summary

Copy edits today flow through many parallel heuristics, planner skills, and rewrite guards. That caused real failures (e.g. pinned “Get Started Today” + “change contact information to …”) when **routing**, **execution**, and **verification** disagreed on the target field.

**Recommendation:** converge copy edits on one pipeline:

```
message + optional UI pin → ConfigFieldIndex → resolveConfigTextEdit → update_config_field → verify copy_field
```

Specialized skills (`update_contact`, `update_hero`, `update_section_copy`, section-type rewrites) become **aliases** during migration, then retire.

---

## Findings

### 1. Incident: pinned contact section copy edit failed

**User action:** Drag “Get Started Today” (contact section), prompt:

`change contact information to helllo this is david`

**Failure:** `Contact email does not match expected value` — edit rolled back, `changedFiles: []`.

**Root causes (three layers):**

| Layer | What happened |
|-------|----------------|
| **Routing** | Agent chose global `update_contact` instead of section copy (`sections[n].body`). User language (“contact information”) mapped to the wrong *family* of fields. |
| **Field mismatch** | Planner params echoed stale `email: "1234@…"` while `value` held the new prose. Verification inferred **email** from params; execution defaulted to **phone** from message keywords. |
| **Value extraction** | `effectiveMessage` appends `(UI-selected section: …)`. Unquoted “to …” parsing captured that suffix as part of the replacement value. |

**Interim fixes shipped (keep until unified resolver lands):**

- Shared `resolveContactUpdateField` for verification + execution alignment
- Pinned contact-section copy routing (`pinnedContactSectionCopy`, `rewriteMisroutedContactCopyPlan`)
- `stripPinnedTargetSuffix` before value extraction
- Regression suite: `contactSectionCopyRegression.test.ts`, `pinnedContactSectionCopy.test.ts`

These patches fix the incident class but **do not scale** — each new section type / phrasing needs more hardcoded rules.

### 2. Architectural drift

Current copy path includes overlapping modules:

| Module | Responsibility |
|--------|----------------|
| `inferSelectedTargetField.ts` | Pinned target field + value inference (title/body/CTA heuristics) |
| `pinnedContactSectionCopy.ts` | Contact-section-specific copy routing |
| `rewriteMisroutedContactCopyPlan.ts` | Post-planner rewrite guard |
| `deterministicPlan.ts` | Many early-return branches (`parseQuotedReplacement`, `parseContactField`, …) |
| `buildVerificationContractFromPlan.ts` | Per-skill verification rules |
| `registry.ts` `paramsForSkill` | Per-skill param normalization (can diverge from verification) |
| Planner prompt | Long skill-specific rules that duplicate deterministic logic |

**Symptom:** every edge case adds a new `if (sectionType === 'contact')` or rewrite guard instead of one resolver.

### 3. What already works (reuse, don’t replace)

| Asset | Why it matters |
|-------|----------------|
| `configFieldPaths.ts` allowlist | Safe mutation surface — keep this |
| `updateConfigFieldInSource` / `update_config_field` | Structured writes — keep this |
| `buildSelectedTargetContext` → EDITABLE FIELDS | Dynamic field list from live siteConfig |
| `parseQuotedReplacement` | Unique `"old" to "new"` find-in-config |
| `resolveDuplicateCopyTarget` | Clarify when same text appears in multiple fields |
| Section catalog + UI pin | Scope search to one section |
| `verifySourceInvariants` `copy_field` | Post-apply verification |

The gap is **unified resolution**, not missing mutation tools.

---

## Target architecture

### One resolver, one writer, one verifier

```
┌─────────────────────────────────────────────────────────────┐
│ buildEditContext                                            │
│   → buildConfigFieldIndex(siteConfig, selectedTargetCtx?)   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ resolveConfigTextEdit(message, index, pin?)                 │
│   Mode A: set field  (pin + label/value scoring)            │
│   Mode B: find/replace ("old" → "new", unique match)        │
│   Mode C: typed field (email, phone, headline, …)           │
│   Output: { fieldPath, value } | clarify | ambiguous         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ execute: update_config_field(fieldPath, value)              │
│ verify:  copy_field(fieldPath, expectedValue)               │
└─────────────────────────────────────────────────────────────┘
```

### Config Field Index

Built once per edit from parsed `siteConfig`. Each row:

```ts
interface ConfigFieldIndexEntry {
  fieldPath: string;           // e.g. sections[2].body
  value: string;
  sectionIndex?: number;
  sectionType?: string;
  sectionTitle?: string;
  scope: 'hero' | 'businessName' | 'contact' | 'section' | 'sectionItem';
  field: string;               // title | body | phone | …
  labels: string[];            // derived tokens for scoring, not hardcoded per type
}
```

Only paths matching `parseConfigFieldPath` are indexed (same allowlist as today).

### Three edit modes

**Mode A — Set field (implicit target)**  
Example: pinned contact section + `change contact information to hello`

1. Strip UI pin suffix from message  
2. Extract replacement value (`hello`)  
3. Scope index to pinned `sectionIndex`  
4. Score candidates by label/token overlap + pin scope  
5. Single winner → apply; tie → numbered clarification (reuse `buildFieldClarification` UX)

**Mode B — Find/replace (explicit old text)**  
Example: `change "Ready to get started?" to "hello"`

1. Search index for exact `find` (optionally scoped by pin)  
2. 0 → clarify; 1 → apply; 2+ → duplicate clarification (extend `resolveDuplicateCopyTarget`)

Generalizes `parseQuotedReplacement` to all allowlisted fields, not only title/body/businessName.

**Mode C — Typed field (explicit field keyword)**  
Example: `change email to david@example.com`

1. Map keyword → `contact.email` (or hero.headline, etc.)  
2. Extract value; no section-type branching

### Scoring (replace hardcoded section rules)

Example weights for Mode A:

| Signal | Weight |
|--------|--------|
| Field in pinned `sectionIndex` | +100 |
| Non-empty current value | +10 |
| Token overlap between message and field labels | +5 per token |
| Global `contact.*` | +20 only when message mentions phone/email/address |
| `presentation.*` fields | excluded for copy edits |

No `if (sectionType === 'contact' && wantsContactSectionCopy)`.

### Planner simplification

**Target planner output for copy:**

```json
{
  "skill": "update_config_field",
  "params": { "fieldPath": "sections[0].body", "value": "hello this is david" }
}
```

Optional second skill for Mode B:

```json
{
  "skill": "replace_config_text",
  "params": {
    "find": "Ready to get started?",
    "replace": "hello this is david",
    "scope": { "sectionIndex": 0 }
  }
}
```

Deterministic `resolveConfigTextEdit` runs **before** LLM. LLM fills gaps only when confidence is low.

**Verification collapses to:**

```json
{ "kind": "copy_field", "field": "<fieldPath>", "expectedValue": "<value>" }
```

Per-skill contact/hero verification branches shrink over time.

---

## Phased migration

### Phase 0 — Done (interim)

- [x] Align `update_contact` verification and execution (`resolveContactUpdateField`)
- [x] Pinned contact copy routing + rewrite guard
- [x] Strip UI pin suffix from value extraction
- [x] Regression tests for Get Started Today scenario

### Phase 1 — Unified resolver (feature-flagged)

**Goal:** One code path handles pinned copy + quoted find/replace + typed fields for all allowlisted paths.

**Deliverables:**

| Item | Path (proposed) |
|------|-----------------|
| Index builder | `src/lib/project-workspace/edit-context/buildConfigFieldIndex.ts` |
| Resolver | `src/lib/project-workspace/edit-context/resolveConfigTextEdit.ts` |
| Wire into deterministic plan | `edit-agent/deterministicPlan.ts` (first copy handler) |
| Flag | `WEBSITE_EDIT_UNIFIED_COPY=1` — fallback to legacy heuristics when off |
| Tests | Port `contactSectionCopyRegression.test.ts` + add index/scoring unit tests |

**Exit criteria:**

- All existing copy regression tests pass with flag on  
- No new section-type-specific modules required for copy routing  
- `rewriteMisroutedContactCopyPlan` unused when flag on (then delete in Phase 2)

### Phase 2 — Collapse skills & guards

**Goal:** Planner and executor treat specialized copy skills as thin aliases.

| Change |
|--------|
| `paramsForSkill`: map `update_contact`, `update_hero`, `update_section_copy` → `{ fieldPath, value }` |
| Planner prompt: copy edits use `update_config_field` or `replace_config_text` only |
| Remove `pinnedContactSectionCopy`, `rewriteMisroutedContactCopyPlan`, most of `inferSelectedTargetField` copy branches |
| `buildVerificationContractFromPlan`: generic `copy_field` only for copy steps |

**Exit criteria:**

- `npm run test:all` green  
- LLM planner smoke (`test:llm:contracts` + targeted copy cases) green  
- Delete feature flag; legacy paths removed

### Phase 3 — Optional LLM field picker (only if needed)

When resolver score spread is tight (top two candidates within threshold):

- Small structured LLM call: input = message + top N index rows → output = `fieldPath`  
- Still execute via `update_config_field` + `copy_field` verify  
- Cheaper and safer than full open-ended planning

### Phase 4 — Beyond siteConfig (defer)

Renderer-only strings (e.g. hardcoded “Contact Information” in `page.tsx`) are **not** in the index today.

Options later:

- Move display strings into `siteConfig` during site generation  
- Add allowlisted `page.tsx` patch patterns (separate tool, strict verify)

Do **not** raw find/replace across TSX until allowlisted.

---

## Non-goals

- Removing the config field allowlist (security + verifyability)  
- Unstructured `write_file` / `custom_code_edit` for routine copy  
- Raw string replace on `siteConfig.ts` source (use structured mutation only)  
- One-shot “LLM edits anything” without verification contract

---

## Success metrics

| Metric | Target |
|--------|--------|
| Copy edit modules with section-type `if` branches | Trend to zero after Phase 2 |
| Verification vs execution field mismatches | Zero in unit + regression suites |
| Pinned section + vague prose prompts | Resolve via index scoring without new guards |
| Planner prompt copy rules | ≤5 lines (point at resolver + field index) |
| Time to add new section type copy support | No code change if fields are in allowlist |

---

## Test strategy

| Tier | Command | Covers |
|------|---------|--------|
| Resolver unit | `npm test -- tests/edit-context/resolveConfigTextEdit.test.ts` | Index, scoring, modes A/B/C |
| Regression | `tests/edit-agent/contactSectionCopyRegression.test.ts` | Get Started Today incident |
| Contract | `npm run test:contracts` | Wiring + invariants |
| LLM smoke | `npm run test:llm:contracts` | Planner still emits valid steps |
| Gate | `npm run test:all` | Full merge gate |

Synthetic fixtures only (`tests/support/syntheticSiteWorkspace.ts`); avoid site-specific frozen fixtures except regressions.

---

## Open questions

1. **Index labels:** derive from field name + section title only, or include DOM `elementKind` from preview pin when present?  
2. **replace_config_text skill:** new domain tool wrapping index search + `updateConfigFieldInSource`, or resolver-only (deterministic) with planner emitting `update_config_field`?  
3. **Flag rollout:** dev-only first, then default-on after one release with flag on in CI?  
4. **Presentation copy:** treat `sections[n].presentation.*` as out of scope for Phase 1–2 (style-only)?

---

## Suggested first PR (Phase 1 scope)

1. Add `buildConfigFieldIndex` + `resolveConfigTextEdit` with Modes A/B/C  
2. Call resolver from `buildDeterministicPlan` when `WEBSITE_EDIT_UNIFIED_COPY=1`  
3. Tests proving parity with contact regression suite under flag  
4. Document flag in `.env.example` (no secret)  
5. Leave legacy path as fallback until parity confirmed, then schedule Phase 2 deletion

---

## References

- Pipeline map: [`EDIT_AGENT.md`](./EDIT_AGENT.md)  
- Allowlisted paths: `src/lib/project-workspace/edit-context/configFieldPaths.ts`  
- Interim contact fixes: `pinnedContactSectionCopy.ts`, `resolveContactUpdateField.ts`, `rewriteMisroutedContactCopyPlan.ts`  
- Incident regression: `tests/edit-agent/contactSectionCopyRegression.test.ts`

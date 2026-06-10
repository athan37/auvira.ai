# Cursor prompt — la-mue-site-monitor (copy/paste for Monitor SWE)

Paste everything below the line into Cursor when opening **https://github.com/lamnguyen8075/la-mue-site-monitor**.

---

## Role

You are the backend SWE for **la-mue-site-monitor** — a FastAPI observability sidecar for the **la-mue** website builder (First Site). la-mue runs the LLM edit agent locally; Monitor scores turns, writes **Arize Phoenix** traces (`builder.turn`), and returns coaching/intent/memory for the **next** edit.

**Read first (this repo):**
- `docs/builder_integration.md` — canonical integration guide
- `docs/goal_and_arize.md` — why Phoenix + Mongo
- `docs/data_capture_and_signals.md` — dashboard signals

**Consumer repo (la-mue, already integrated):**
- GitHub: `https://github.com/athan37/la-mue-site-builder` (package: `ai-website-migration-agent`)
- Production API base: `https://la-mue-site-monitor-production.up.railway.app/api/v1`
- Phoenix: `https://app.phoenix.arize.com/s/lamnguyen8075-sjsu` (project `la-mue-site-monitor-phoenix`)

---

## Architecture (do not break)

```text
la-mue edit agent (Vercel)
  ① GET  /context?conversation_id=…&latest_user_message=…   (before LLM)
  ② POST /intent  { user_message, selected_target, … }       (before LLM)  ← NEW CONTRACT
  ③ GET  /memory  (before LLM)                               ← EXPECTED, currently 404 in prod
  ④ runWebsiteEdit locally
  ⑤ POST /turns   (after edit — grade + Phoenix trace + Mongo)
  ⑥ POST /memory  (after success — upsert slots)             ← EXPECTED
```

Monitor is **not** an editor. Never run the site LLM inside Monitor.

---

## Priority 1 — `POST /api/v1/projects/{project_id}/intent` (turn-aware, single sentence)

la-mue **already calls this** before each edit. Until it returns a valid body, la-mue falls back to a local hardcoded intent sentence.

### Request

```http
POST /api/v1/projects/{project_id}/intent
X-Tenant-Id: la-mue
X-API-Key: <OBSERVABILITY_API_KEY>
Content-Type: application/json
```

```json
{
  "user_message": "change background to my favorite color",
  "selected_target": {
    "kind": "section",
    "section_index": 2,
    "section_type": "contact",
    "section_title": "Contact Us",
    "element_label": "Contact Information",
    "field_path": "sections[2].presentation.cardClass",
    "target_chain": [
      { "role": "section", "label": "Contact Us" },
      { "role": "container", "label": "Contact card" },
      { "role": "element", "label": "Contact Information" }
    ]
  },
  "conversation_id": "6a26cc3deeea946b980a52da-editor"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `user_message` | yes | Current owner message (max 8000 chars) |
| `selected_target` | no | **Same snake_case shape as `POST /turns` `selected_target`** — do not invent a second schema |
| `conversation_id` | no | Default `{project_id}-editor` |

### Response — **one English sentence only**

```json
{
  "intent": "Change the Contact Us section card background (sections[2].presentation.cardClass) to green, the owner's favorite color."
}
```

| Rule | Detail |
|------|--------|
| Shape | Top-level `intent: string` only (max 500 chars) |
| No | `keywords`, `intents[]`, `turn_count`, `resolved_slots`, nested objects |
| Always | Return a non-empty sentence — never `null` / `""` |
| When resolved | Include concrete `field_path` + value (`green`, `gradient-blue`, quoted copy) |
| When ambiguous | One sentence stating what is missing, e.g. `"…favorite color; color not yet known from project history."` |

### How to build the sentence

Aggregate from **stored `POST /turns` history** for this project/conversation:
- `user_message`, `selected_target`, `classified_intent`, `target_resolved`
- `plan.resolved_references` (e.g. `{ phrase: "my favorite color", resolved_value: "green" }`)
- Prior turns with same pin (`field_path`, `element_label`)

**Do not** require la-mue to sync Mongo `ProjectMessage` chat rows.

Apply same PII redaction policy as `GET /context` `latest_user_message`.

### Examples

```json
{ "intent": "Change the hero headline (hero.headline) to \"Schedule Your Free Consultation\"." }
```

```json
{ "intent": "Change sections[0].presentation.backgroundClass to blue." }
```

```json
{ "intent": "Change the Contact Us section background to the owner's favorite color; color not yet known from project history." }
```

### Legacy

Keep `GET /projects/{id}/intent` (keywords/`intents[]`) for dashboards if useful; la-mue planner no longer consumes it for edit routing.

---

## Priority 2 — `GET` + `POST /api/v1/projects/{project_id}/memory`

la-mue client: `fetchObservabilityMemory` / `postObservabilityMemory` in consumer `src/lib/observability/client.ts`.

**Current prod status:** `GET /memory` returns **404** — la-mue uses local Mongo fallback until this ships.

### `GET /memory` response

```json
{
  "slots": [
    {
      "id": "slot-abc",
      "kind": "color",
      "phrase_aliases": ["my favorite color", "brand color"],
      "value": "green",
      "scope": { "type": "project" },
      "provenance": { "turn_id": "job-123", "user_message_excerpt": "make it green" },
      "updated_at": "2026-06-09T12:00:00Z"
    }
  ],
  "turn_count": 41,
  "updated_at": "2026-06-09T12:00:00Z"
}
```

**Slot kinds:** `color` | `copy` | `cta` | `style_token` | `edit_pattern`

**Scope types:** `project` | `hero` | `section_type` | `section_index` | `field`

**`edit_pattern` value shape:**

```json
{ "what": "style_card", "params": { "presentationField": "cardClass" } }
```

### `POST /memory` — upsert after successful edit

la-mue sends slots derived from `plan.resolved_references` on success turns. Soft-fail on error (must not break edit flow).

---

## Priority 3 — Ensure `POST /turns` captures full la-mue context

la-mue now sends these fields on every turn (see consumer `mapTurnPayload.ts`). Persist and use them for intent/memory/coaching:

| Field | Purpose |
|-------|---------|
| `classified_intent` | `copy`, `style_background`, `style_card`, `structure`, … |
| `selected_target` | Pinned preview target (snake_case) |
| `target_resolved` | Resolved section/field after target resolution |
| `pre_gate_blocked` | Clarification before planner |
| `ambiguity_reasons` | Why clarify fired |
| `planner_path` | `deterministic` \| `explorer` \| `llm` \| `clarification` |
| `plan.resolved_references` | Implicit ref resolutions (`my favorite color` → `green`) |
| `plan.project_memory_slots_written` | Count of slots emitted post-edit |
| `plan.planner_path` | Duplicate of top-level for plan blob |
| `idempotent_success` | Retry-safe success |
| `is_refinement_turn` | Short follow-up turn |

**Phoenix span:** Keep `builder.turn` root + `builder.phase.*` children; session id `{project_id}:{conversation_id}`.

---

## Auth & ids (unchanged)

```http
X-Tenant-Id: la-mue
X-API-Key: <OBSERVABILITY_API_KEY>
```

| ID | la-mue mapping |
|----|----------------|
| `project_id` | `WebsiteProject._id` |
| `conversation_id` | `{projectId}-editor` |
| `turn_id` | Edit job id (idempotent) |

---

## Testing against la-mue

1. Deploy Monitor to Railway (or run locally `python main.py`).
2. la-mue env:
   ```env
   OBSERVABILITY_API_URL=https://la-mue-site-monitor-production.up.railway.app
   OBSERVABILITY_TENANT_ID=la-mue
   OBSERVABILITY_API_KEY=<shared key>
   OBSERVABILITY_INTENT_HARDCODE=0
   ```
3. Probe scripts in la-mue (consumer repo):
   - `npx tsx scripts/probe-intent-memory.ts`
   - `npx tsx scripts/probe-context-series.ts`
4. Test project with real turns: `6a26cc3deeea946b980a52da` (41+ turns in Monitor).

**Acceptance — `POST /intent`:**
- Favorite color + Contact card pin → sentence includes `sections[N].presentation.cardClass` and concrete color when history has it
- Unresolved favorite → sentence says color not yet known (no empty response)

**Acceptance — `/memory`:**
- `GET` returns slots after successful color/copy edits
- `POST` upsert idempotent; la-mue `npm run test:observability` passes consumer contract tests

---

## Hackathon / Arize alignment (context)

Google Cloud Rapid Agent Hackathon (Arize track): la-mue will add **Phoenix MCP** (`@arizeai/phoenix-mcp`) so the agent reads `builder.turn` traces at runtime. Monitor remains the **write + grade** pipeline. Strong Monitor `POST /turns` + rich `eval.*` span attributes make Phoenix MCP coaching more useful.

Pitch line (from `goal_and_arize.md`):

> Arize Phoenix is the memory of an AI editor — bad turns leave eval traces; the next prompt gets coaching hints from those traces.

---

## Implementation checklist

- [ ] `POST /projects/{id}/intent` — single-sentence response per contract above
- [ ] `GET /projects/{id}/memory` — slot list + `turn_count`
- [ ] `POST /projects/{id}/memory` — upsert slots from turn outcomes
- [ ] Store `classified_intent`, `selected_target`, `plan.resolved_references` on turn documents
- [ ] Update `docs/builder_integration.md` — replace legacy `GET /intent` vocabulary section with `POST /intent` sentence contract
- [ ] OpenAPI / Swagger examples for new endpoints
- [ ] Unit tests + `test/la_mue_v1_simulator.py` coverage for intent/memory
- [ ] Deploy Railway; verify with la-mue probe scripts (no 404 on `/memory`)

---

## Out of scope

- Do not implement la-mue's edit agent or GitLab workspace logic in Monitor
- Do not require la-mue to POST full chat history
- Do not return keyword arrays on `POST /intent` response (la-mue parser rejects non-string `intent`)

---

## Questions / sync

Coordinate with la-mue team on:
- Exact `selected_target` fields la-mue serializes (`serializeSelectedTargetForMonitor`)
- When `POST /intent` is live → la-mue sets `OBSERVABILITY_INTENT_HARDCODE=0`

Consumer reference files (la-mue repo):
- `src/lib/observability/client.ts`
- `src/lib/observability/fetchObservabilityIntent.ts`
- `src/lib/observability/fetchObservabilityMemory.ts`
- `src/lib/observability/mapTurnPayload.ts`
- `src/lib/observability/serializeTurnContext.ts`
- `tests/observability/fetchObservabilityIntent.test.ts`
- `tests/observability/hardcodedIntentSentence.test.ts` (shows fallback behavior until Monitor ships)

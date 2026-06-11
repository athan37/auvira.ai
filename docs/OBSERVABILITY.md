# Site Monitor observability integration

Connects the editor and clone/generation flows to [la-mue-site-monitor](https://github.com/lamnguyen8075/la-mue-site-monitor) for turn scoring, Phoenix traces, and optional coaching hints.

## Environment variables

Observability is **on by default**. Uses `config/observability-public.env` (shipped read-only client key). Set `OBSERVABILITY_ENABLED=0` to opt out.

```env
# Optional override — omit for zero-config local dev
# OBSERVABILITY_API_KEY=<secret>
OBSERVABILITY_TIMEOUT_MS=5000        # optional, default 5000

# Phoenix / debug UI (optional)
PHOENIX_APP_URL=https://app.phoenix.arize.com
PHOENIX_TRACE_URL_TEMPLATE=https://app.phoenix.arize.com/traces/{traceId}
NEXT_PUBLIC_OBSERVABILITY_DEBUG=1   # show grade + trace link on assistant chat bubbles
NEXT_PUBLIC_PHOENIX_APP_URL=https://app.phoenix.arize.com
NEXT_PUBLIC_PHOENIX_TRACE_URL_TEMPLATE=https://app.phoenix.arize.com/traces/{traceId}
```

| Flag | Default | When off (`=0`) |
|------|---------|-----------------|
| `OBSERVABILITY_ENABLED` | on (if API key set) | No sidecar HTTP; product flows unchanged |
| `OBSERVABILITY_COACHING_ENABLED` | on | Turns still recorded; planner prompts unchanged |

When observability is on but coaching is off, context is still fetched and logged to the edit job (`observability_context` log entry) — planner prompts are unchanged.

## Site Monitor `builder_type` compatibility (OpenAPI v0.6.0)

Site Monitor validates `builder_type` as a **strict enum** on `POST /turns`:

| Allowed values |
|----------------|
| `html_builder` |
| `la_mue_edit` |

**Do not send** `la_mue_clone` or `la_mue_generate` until Site Monitor extends its schema (422 otherwise).

la-mue uses [`normalizeObservabilityBuilderType`](../src/lib/observability/normalizeObservabilityBuilderType.ts):

| Internal intent | `builder_type` on wire | Disambiguation |
|-----------------|------------------------|----------------|
| Editor edit | `la_mue_edit` | `plan.flow_type: "edit"` |
| Clone wizard | `la_mue_edit` (fallback) | `plan.flow_type: "clone"`, `plan.clone_phase` |
| Scratch / generate | `la_mue_edit` (fallback) | `plan.flow_type: "generate"` |

Sub-phase data (`phase_events`, `planner_path`) is serialized into the Monitor `plan` object (`additionalProperties: true`).

## Call order (per editor edit)

1. `createEditJob` → compute `turn_index`
2. `ensureObservabilityRegistration` (project + `{projectId}-editor` conversation)
3. Parallel `GET /context` + `GET /intent` (soft-fail; logged to edit job)
4. Local edit agent runs (`runWebsiteEdit`) with agent sub-phase timing
5. `POST /turns` with redacted payload → store `metadata.arize.externalId` (trace_id)

### Phase B: `/intent` and implicit reference resolution

`POST /api/v1/projects/{project_id}/intent` returns a single **intent sentence** for the current user message (and optional pinned target).

la-mue uses the sentence as optional evidence for the [Implicit Reference Resolver](./EDIT_AGENT.md#implicit-reference-resolver) and (when coaching is on) planner block `## Project intent`. Chat UI shows only the intent sentence on assistant messages.

| Flag | Fetch `/context` + `/intent` | Planner intent + coaching | Resolver evidence |
|------|------------------------------|---------------------------|-------------------|
| `OBSERVABILITY_ENABLED=0` | No | No | Chat history / site config only |
| Enabled, `OBSERVABILITY_COACHING_ENABLED=0` | Yes | No | Yes (intent + optional LLM) |
| Both on | Yes | Yes | Yes |

**Not a routing or safety gate.** `/intent` does not pick section targets, bypass the ambiguity gate, or replace verification.

## Identity mapping

### Editor

| Monitor | la-mue |
|---------|--------|
| `project_id` | `WebsiteProject._id` |
| `conversation_id` | `{projectId}-editor` |
| `turn_id` | `ProjectEditJob._id` |

### Clone / generation

| Phase | `project_id` | `conversation_id` | `turn_id` |
|-------|--------------|-------------------|-----------|
| process / revise-plan | `clone-{jobId}` or `createdProjectId` | `clone-{jobId}-wizard` | `{jobId}-process`, `{jobId}-revise-{n}` |
| build-preview | `createdProjectId` when available | `{projectId}-clone-build` | `{jobId}-build-preview` |
| preview-chat | `createdProjectId` | `{projectId}-clone-preview` | `{jobId}-preview-{uuid}` |

## PII policy

Before `POST /turns`, payloads pass through [`redactPii`](../src/lib/observability/redactPii.ts):

- Emails and phone numbers in `user_message` / `reply` → `[REDACTED_EMAIL]` / `[REDACTED_PHONE]`
- `site_config` — section index/type/title/itemCount only; contact fields stripped

## Safety

Monitor failures **never fail the product flow**. All sidecar calls are wrapped; errors log with `[observability]` and return `null`. A 422 on `POST /turns` sets `metadata.arize.syncStatus: "failed"` only.

## Phoenix

Filter spans named `builder.turn` in [Phoenix Cloud](https://app.phoenix.arize.com/). Until Monitor adds clone/generate enum values, filter by `plan.flow_type` in stored turn payloads.

## Admin / debug UI

- **Chat:** successful edits with applied project memory show an inline **Used project context** line and a sky **Context** chip; clarification/failure turns show a violet **Tips** chip when guidance or coaching exists (click to expand; Escape or click outside to close). Coaching "hints applied" badges are not shown on success. Set `NEXT_PUBLIC_OBSERVABILITY_DEBUG=1` for grade badges and Phoenix trace links ([`ObservabilityTraceChip`](../src/components/project/ObservabilityTraceChip.tsx)).
- **Admin page:** [`/admin/observability`](../src/app/admin/observability/page.tsx) — recent turn scores across all projects via `GET /api/admin/observability`.
- **Per-project page:** [`/projects/{projectId}/observability`](../src/app/projects/[projectId]/observability/page.tsx) — analytics dashboard wired to Site Monitor (conversation picker, **Analyze session**). Data is Monitor-only when enabled (no Mongo chat-metadata fallback).

### Per-project analytics API

Auth: project owner only (`getOwnerProject`). Never exposes `OBSERVABILITY_API_KEY` to the client.

**Bootstrap** — `GET /api/projects/{projectId}/observability/bootstrap`

Returns `conversations[]`, `defaultConversationId` (`{projectId}-editor`), optional `health` from Monitor `/health/ready`.

**Analyze session** — `POST /api/projects/{projectId}/observability/analyze`

Body: `{ conversationId? }`.

Parallel server fetch: `GET .../dashboard?turn_limit=50`, `GET .../intent?turn_limit=200`, `GET .../context?conversation_id&latest_user_message` (context uses a fixed default message server-side).

| Response field | Panel group |
|----------------|-------------|
| `sessionSummary` | Group 1 — dashboard.cards (turn count, grades, pass rates, trend, top_issue_label) |
| `intentProfile` | Group 2 — keywords, intents, turn_count, scope |
| `coachingContext` | Group 3 — coaching_hints, recurring_issues, missing_keywords, quality_snapshot |
| `developerAnalytics` | Groups 5–9 — executive_kpis, learning_metrics, charts, turns[], improvement_brief |

**Turn intent lookup** — `GET /api/projects/{projectId}/observability/intent?userMessage=` (turn-table intent cells).

## Code entry points

| Path | Role |
|------|------|
| [`src/lib/metrics/aggregateObservabilityMetrics.ts`](../src/lib/metrics/aggregateObservabilityMetrics.ts) | Admin + per-project turn aggregation |
| [`src/app/api/projects/[projectId]/observability/bootstrap/route.ts`](../src/app/api/projects/[projectId]/observability/bootstrap/route.ts) | Conversations + health bootstrap |
| [`src/app/api/projects/[projectId]/observability/analyze/route.ts`](../src/app/api/projects/[projectId]/observability/analyze/route.ts) | Parallel Monitor session analyze |
| [`src/app/api/projects/[projectId]/observability/intent/route.ts`](../src/app/api/projects/[projectId]/observability/intent/route.ts) | Turn-table GET /intent lookup |
| [`src/lib/observability/`](../src/lib/observability/) | Client, redaction, turn recording, builder_type normalization |
| [`src/lib/observability/recordCloneTurn.ts`](../src/lib/observability/recordCloneTurn.ts) | Clone wizard turn recording |
| [`src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts`](../src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts) | Editor hooks + agent sub-span payload |
| Clone routes: `process`, `build-preview`, `preview-chat`, `revise-plan` | Generation observability |

## Rollout

Defaults are **on** when `OBSERVABILITY_API_KEY` is configured (coaching included).

To run observe-only (record turns without planner hints):

```env
OBSERVABILITY_COACHING_ENABLED=0
```

To disable entirely:

```env
OBSERVABILITY_ENABLED=0
```

## Tests

```bash
npm run test:observability
npm run test:observability:clone
npm run test:observability:live
npm run test:observability:accuracy:llm
```

**Accuracy (not latency):**

- `OBSERVABILITY_ENABLED=0` vs observe-only `ENABLED=1` + `COACHING=0` → **same planner prompt** (no edit accuracy change; sidecar only records).
- Accuracy gains require `OBSERVABILITY_COACHING_ENABLED=1` (coaching hints in `planEdit`).
- LLM A/B (`test:observability:accuracy:llm`) runs control vs coached on the same edit.

## Follow-up (Site Monitor repo)

Extend Pydantic enums on `RecordTurnRequest`, `CreateBuilderProjectRequest`, and `AnalyzeBuilderProjectRequest` to include `la_mue_clone` and `la_mue_generate`, then update `MONITOR_SUPPORTED_BUILDER_TYPES` in la-mue to stop fallback.

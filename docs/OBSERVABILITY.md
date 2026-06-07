# Site Monitor observability integration

Connects the editor edit stream to [la-mue-site-monitor](https://github.com/lamnguyen8075/la-mue-site-monitor) for turn scoring, Phoenix traces, and optional coaching hints.

## Environment variables

```env
OBSERVABILITY_ENABLED=0              # master: register, GET context, POST turns
OBSERVABILITY_COACHING_ENABLED=0     # inject hints into planEdit (requires observability on)
OBSERVABILITY_API_URL=https://la-mue-site-monitor-production.up.railway.app
OBSERVABILITY_TENANT_ID=la-mue
OBSERVABILITY_API_KEY=<secret>
OBSERVABILITY_TIMEOUT_MS=5000        # optional, default 5000
```

| Flag | When `=1` |
|------|-----------|
| `OBSERVABILITY_ENABLED` | `POST /projects`, `POST /conversations`, `GET /context`, `POST /turns`, store `trace_id` on chat messages |
| `OBSERVABILITY_COACHING_ENABLED` | Append coaching hints to [`buildPlanEditSystemPrompt`](../src/lib/project-workspace/planner/planEditPrompt.ts) |

When observability is on but coaching is off, context is still fetched and logged to the edit job (`observability_context` log entry) — planner prompts are unchanged.

## Call order (per edit)

1. `createEditJob` → compute `turn_index`
2. `ensureObservabilityRegistration` (project + `{projectId}-editor` conversation)
3. `GET /context` → coaching hints (logged; injected only if coaching flag on)
4. Local edit agent runs (`runWebsiteEdit`)
5. `POST /turns` with redacted payload → store `metadata.arize.externalId` (trace_id)

## Identity mapping

| Monitor | la-mue |
|---------|--------|
| `project_id` | `WebsiteProject._id` |
| `conversation_id` | `{projectId}-editor` |
| `turn_id` | `ProjectEditJob._id` |

## PII policy

Before `POST /turns`, payloads pass through [`redactPii`](../src/lib/observability/redactPii.ts):

- Emails and phone numbers in `user_message` / `reply` → `[REDACTED_EMAIL]` / `[REDACTED_PHONE]`
- `site_config` — section index/type/title/itemCount only; contact fields stripped

## Safety

Monitor failures **never fail the edit**. All sidecar calls are wrapped; errors log with `[observability]` and return `null`.

## Phoenix

Filter spans named `builder.turn` in [Phoenix Cloud](https://app.phoenix.arize.com/).

## Code entry points

| Path | Role |
|------|------|
| [`src/lib/observability/`](../src/lib/observability/) | Client, redaction, turn recording |
| [`src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts`](../src/app/api/projects/[projectId]/code-agent/edit/stream/route.ts) | Hooks on success / clarification / failure |

## Rollout

1. Enable `OBSERVABILITY_ENABLED=1` on staging; keep coaching off
2. Confirm turns in monitor `/demo` and Phoenix
3. Enable `OBSERVABILITY_COACHING_ENABLED=1` after traces look correct

## Tests

```bash
npm run test:observability
npm run test:observability:live
npm run test:observability:accuracy:llm
```

**Accuracy (not latency):**
- `OBSERVABILITY_ENABLED=0` vs observe-only `ENABLED=1` + `COACHING=0` → **same planner prompt** (no edit accuracy change; sidecar only records).
- Accuracy gains require `OBSERVABILITY_COACHING_ENABLED=1` (coaching hints in `planEdit`).
- Live tests compare monitor `turn_scores` for failed vs successful turns.
- LLM A/B (`test:observability:accuracy:llm`) runs control vs coached on the same edit:
  - **Baseline:** straightforward gallery background (coached should match control).
  - **Hard:** paraphrase targeting, numbered catalog replies, recency override, wrong-number correction, contact cardClass vs section bg — each with coaching hints that mirror prior failure patterns from Site Monitor.
  - Console logs `[observability accuracy A/B]` with `controlScore`, `coachedScore`, and `delta`.

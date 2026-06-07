import { isObservabilityCoachingEnabled } from './config';
import { mergeLatencyBreakdown } from './agentPhaseTimer';
import {
  normalizeObservabilityBuilderType,
  type ObservabilityBuilderTypeInput,
} from './normalizeObservabilityBuilderType';
import { buildRedactedSiteConfigSnapshot } from './redactPii';
import type {
  ObservabilityCoachingContext,
  ObservabilityEditOutcome,
  ObservabilityFlowType,
  ObservabilityTurnPhase,
  RecordTurnPayload,
} from './types';
import type { EditStepTimer } from '@/lib/project-workspace/editTiming';

export interface MapTurnPayloadInput {
  turnId: string;
  turnIndex: number;
  userMessage: string;
  reply: string;
  outcome: ObservabilityEditOutcome;
  verifyPass?: boolean;
  buildGatePass?: boolean;
  changedFiles?: string[];
  siteConfigParsed?: {
    businessName?: string;
    sections?: Array<{ type?: string; title?: string; items?: unknown[] }>;
  } | null;
  /** Route-level timer (edit stream) or synthetic timer for clone/generate. */
  editTimer: EditStepTimer;
  targetSection?: string | null;
  needsClarification?: boolean;
  coachingContext?: ObservabilityCoachingContext | null;
  /** Internal builder intent — normalized before POST /turns. */
  requestedBuilderType?: ObservabilityBuilderTypeInput;
  flowType?: ObservabilityFlowType;
  clonePhase?: string;
  phaseEvents?: ObservabilityTurnPhase[];
  agentLatencyBreakdown?: Record<string, number>;
  plannerPath?: 'deterministic' | 'explorer' | 'llm' | 'clarification';
  latencyMs?: number;
}

function latencyBreakdown(editTimer: EditStepTimer): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { phase, durationMs } of editTimer.summary()) {
    out[phase] = durationMs;
  }
  return out;
}

function buildPlanMetadata(input: MapTurnPayloadInput, flowType: ObservabilityFlowType): Record<string, unknown> {
  const plan: Record<string, unknown> = { flow_type: flowType };
  if (input.clonePhase) plan.clone_phase = input.clonePhase;
  if (input.plannerPath) plan.planner_path = input.plannerPath;
  if (input.phaseEvents?.length) {
    plan.phase_events = input.phaseEvents.map((event) => ({
      name: event.name,
      duration_ms: event.durationMs,
      outcome: event.outcome,
      metadata: event.metadata,
    }));
  }
  return plan;
}

/** Map turn state to Site Monitor POST /turns payload (before PII redaction). */
export function mapTurnPayload(input: MapTurnPayloadInput): RecordTurnPayload {
  const coachingEnabled = isObservabilityCoachingEnabled();
  const hintCount = input.coachingContext?.coachingHints.length ?? 0;
  const coachingApplied = coachingEnabled && hintCount > 0;
  const requested = input.requestedBuilderType ?? 'la_mue_edit';
  const { builderType, flowType } = normalizeObservabilityBuilderType({ requested });
  const resolvedFlowType = input.flowType ?? flowType;

  const routeBreakdown = latencyBreakdown(input.editTimer);
  const mergedBreakdown =
    input.agentLatencyBreakdown && Object.keys(input.agentLatencyBreakdown).length > 0
      ? mergeLatencyBreakdown(routeBreakdown, input.agentLatencyBreakdown)
      : routeBreakdown;

  return {
    builder_type: builderType,
    turn_id: input.turnId,
    turn_index: input.turnIndex,
    user_message: input.userMessage,
    reply: input.reply,
    outcome: input.outcome,
    verify_pass: input.verifyPass,
    build_gate_pass: input.buildGatePass,
    changed_files: input.changedFiles ?? [],
    site_config: buildRedactedSiteConfigSnapshot(input.siteConfigParsed),
    latency_ms: input.latencyMs ?? input.editTimer.totalMs(),
    latency_breakdown_ms: mergedBreakdown,
    target_section: input.targetSection ?? null,
    needs_clarification: input.needsClarification ?? false,
    experiment_variant: coachingApplied ? 'coached' : 'control',
    coaching_applied: coachingApplied,
    coaching_hint_count: hintCount,
    plan: buildPlanMetadata(input, resolvedFlowType),
  };
}

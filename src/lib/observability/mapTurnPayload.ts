import { isObservabilityCoachingEnabled } from './config';
import { buildRedactedSiteConfigSnapshot } from './redactPii';
import type { ObservabilityCoachingContext, ObservabilityEditOutcome, RecordTurnPayload } from './types';
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
  editTimer: EditStepTimer;
  targetSection?: string | null;
  needsClarification?: boolean;
  coachingContext?: ObservabilityCoachingContext | null;
}

function latencyBreakdown(editTimer: EditStepTimer): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { phase, durationMs } of editTimer.summary()) {
    out[phase] = durationMs;
  }
  return out;
}

/** Map edit-stream state to Site Monitor POST /turns payload (before PII redaction). */
export function mapTurnPayload(input: MapTurnPayloadInput): RecordTurnPayload {
  const coachingEnabled = isObservabilityCoachingEnabled();
  const hintCount = input.coachingContext?.coachingHints.length ?? 0;
  const coachingApplied = coachingEnabled && hintCount > 0;

  return {
    builder_type: 'la_mue_edit',
    turn_id: input.turnId,
    turn_index: input.turnIndex,
    user_message: input.userMessage,
    reply: input.reply,
    outcome: input.outcome,
    verify_pass: input.verifyPass,
    build_gate_pass: input.buildGatePass,
    changed_files: input.changedFiles ?? [],
    site_config: buildRedactedSiteConfigSnapshot(input.siteConfigParsed),
    latency_ms: input.editTimer.totalMs(),
    latency_breakdown_ms: latencyBreakdown(input.editTimer),
    target_section: input.targetSection ?? null,
    needs_clarification: input.needsClarification ?? false,
    experiment_variant: coachingApplied ? 'coached' : 'control',
    coaching_applied: coachingApplied,
    coaching_hint_count: hintCount,
  };
}

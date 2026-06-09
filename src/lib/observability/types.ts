import type { MonitorBuilderType } from './normalizeObservabilityBuilderType';

export type ObservabilityEditOutcome = 'success' | 'failed' | 'clarification';

export type ObservabilityFlowType = 'edit' | 'clone' | 'generate';

export interface ObservabilityCoachingContext {
  coachingHints: string[];
  constraints: Record<string, unknown>;
  qualitySnapshot: Record<string, unknown>;
  recurringIssues: string[];
  source: string;
}

/** Site Monitor GET /intent — recurring project vocabulary (optional planner/resolver evidence). */
export interface ObservabilityProjectIntent {
  keywords: string[];
  intents: Array<{ label: string; count: number }>;
  turn_count: number;
  updated_at: string | null;
}

export interface ObservabilityTurnPhase {
  name: string;
  durationMs: number;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordTurnPayload {
  builder_type: MonitorBuilderType;
  turn_id: string;
  turn_index: number;
  user_message: string;
  reply: string;
  outcome: ObservabilityEditOutcome;
  verify_pass?: boolean;
  build_gate_pass?: boolean;
  changed_files?: string[];
  site_config?: Record<string, unknown> | null;
  latency_ms: number;
  latency_breakdown_ms?: Record<string, number>;
  target_section?: string | null;
  needs_clarification?: boolean;
  experiment_variant?: string;
  coaching_applied?: boolean;
  coaching_hint_count?: number;
  /** Flow metadata serialized for Monitor (flow_type, phase_events, clone_phase). */
  plan?: Record<string, unknown>;
}

export interface RecordTurnResponse {
  turn_id: string;
  trace_id: string;
  created: boolean;
  turn_scores?: {
    overall?: number;
    grade?: string;
  };
}

export interface ObservabilityTurnMetadata {
  arize: {
    syncStatus: 'synced' | 'failed';
    externalId?: string;
    syncedAt?: string;
    grade?: string;
    overallScore?: number;
  };
  observability?: {
    experimentVariant?: string;
    coachingHintCount?: number;
    coachingApplied?: boolean;
    coachingHints?: string[];
    flowType?: ObservabilityFlowType;
  };
}

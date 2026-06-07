export type ObservabilityEditOutcome = 'success' | 'failed' | 'clarification';

export interface ObservabilityCoachingContext {
  coachingHints: string[];
  constraints: Record<string, unknown>;
  qualitySnapshot: Record<string, unknown>;
  recurringIssues: string[];
  source: string;
}

export interface RecordTurnPayload {
  builder_type: 'la_mue_edit';
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
  };
}

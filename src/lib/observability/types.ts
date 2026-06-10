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

/** Site Monitor POST /intent — single resolved intent sentence for this edit turn. */
export interface ObservabilityProjectIntent {
  sentence: string;
}

export type ProjectMemorySlotKind = 'color' | 'copy' | 'cta' | 'style_token' | 'edit_pattern';

/** Structured edit pattern stored in project memory. */
export interface EditPatternValue {
  what: 'copy' | 'style_background' | 'style_text' | 'style_card' | 'structure';
  params?: Record<string, unknown>;
}

export type ProjectMemoryScope =
  | { type: 'project' }
  | { type: 'section_type'; sectionType: string }
  | { type: 'section_index'; sectionIndex: number }
  | { type: 'field'; fieldPath: string }
  | { type: 'hero' };

/** Site Monitor GET /memory — typed project memory slot. */
export interface ProjectMemorySlot {
  id: string;
  kind: ProjectMemorySlotKind;
  phrase_aliases: string[];
  value: string | EditPatternValue;
  scope: ProjectMemoryScope;
  provenance?: { turn_id: string; user_message_excerpt?: string };
  updated_at?: string;
}

/** Site Monitor GET /memory response. */
export interface ObservabilityProjectMemory {
  slots: ProjectMemorySlot[];
  turn_count: number;
  updated_at: string | null;
}

export interface UpsertProjectMemoryPayload {
  slots: Array<Omit<ProjectMemorySlot, 'id' | 'updated_at'> & { id?: string }>;
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
  /** Blocked by ambiguity/implicit gate before planEdit. */
  pre_gate_blocked?: boolean;
  ambiguity_reasons?: string[];
  planner_path?: string | null;
  target_resolved?: Record<string, unknown> | null;
  selected_target?: Record<string, unknown> | null;
  idempotent_success?: boolean;
  classified_intent?: string | null;
  is_refinement_turn?: boolean;
  previous_changed_file_count?: number | null;
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

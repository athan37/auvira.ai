import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import type { EditFocusStack } from '@/lib/project-workspace/edit-shared/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { ImplicitReferenceKind } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';

export type ProjectChatOutcome = 'success' | 'clarification' | 'failure';
export type ArizeSyncStatus = 'pending' | 'synced' | 'failed';

export interface ProjectMessageAttachmentRef {
  id: string;
  path: string;
  previewUrl: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export interface ProjectMessageTiming {
  totalMs?: number;
  phases?: Array<{ phase: string; durationMs: number }>;
  slowestPhase?: string;
  slowestMs?: number;
}

export interface ProjectMessageArizeMetadata {
  syncStatus: ArizeSyncStatus;
  syncedAt?: string;
  externalId?: string;
  grade?: string;
  overallScore?: number;
}

export interface ProjectMessageVocabulary {
  /** Monitor POST /intent sentence fed into this edit. */
  sentence: string;
  /** @deprecated Legacy GET /intent vocabulary on old messages. */
  keywords?: string[];
  intents?: Array<{ label: string; count: number }>;
  turnCount?: number;
}

/** Site Monitor GET /context snapshot for the edit request (planner/resolver feed). */
export interface ProjectMessageMonitorContext {
  source: string;
  coachingHints: string[];
  recurringIssues: string[];
  constraintSummary?: string;
  qualityGrade?: string;
  qualityScore?: number;
}

export interface ProjectMessageResolvedReference {
  phrase: string;
  resolvedValue: string;
  source: string;
}

export interface ProjectMessageObservabilityMetadata {
  experimentVariant?: string;
  coachingHintCount?: number;
  coachingApplied?: boolean;
  /** Hint text injected into the planner when coaching was applied (shown in chat hints panel). */
  coachingHints?: string[];
  /** Site Monitor GET /context fed into this edit (planner/resolver). */
  monitorContext?: ProjectMessageMonitorContext;
  /** Site Monitor POST /intent sentence fed into this edit. */
  intentFeed?: ProjectMessageVocabulary;
  /** @deprecated Use intentFeed — kept for persisted messages. */
  projectVocabulary?: ProjectMessageVocabulary;
  /** @deprecated Legacy chat field — use appliedProjectMemory on new messages. */
  resolvedReferences?: ProjectMessageResolvedReference[];
  /** Resolved phrases applied on a successful edit (user-facing: Project Memory). */
  appliedProjectMemory?: ProjectMessageResolvedReference[];
  flowType?: 'edit' | 'clone' | 'generate';
}

/** Target locked while awaiting owner clarification on a multi-turn edit. */
export interface ClarificationAnchor {
  kind: 'hero' | 'section';
  sectionIndex?: number;
  title?: string;
}

export interface PendingImplicitRef {
  phrase: string;
  kind: ImplicitReferenceKind;
}

export interface ProjectMessageMetadata {
  clientMessageId?: string;
  editJobId?: string;
  outcome?: ProjectChatOutcome;
  attachments?: ProjectMessageAttachmentRef[];
  changedFiles?: string[];
  suggestedReplies?: string[];
  errorStage?: string;
  errorTraceExcerpt?: string;
  timing?: ProjectMessageTiming;
  previewVersion?: number;
  strategy?: string;
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  lastGalleryEdit?: {
    sectionIndex: number;
    title: string;
    imageUrls: string[];
    imageCount: number;
  };
  editFocusStack?: EditFocusStack;
  /** Preview section pinned when the user sent this message (drag-to-chat). */
  selectedTarget?: SelectedTargetInput;
  /** Surface picked from explorer clarification (maps to fieldPath server-side). */
  selectedSurfaceId?: string;
  /** Edit target preserved across clarification turns. */
  clarificationAnchor?: ClarificationAnchor;
  /** Unresolved implicit phrase awaiting a follow-up value (e.g. color after "What color?"). */
  pendingImplicitRef?: PendingImplicitRef;
  /** @deprecated Legacy — resolved refs on assistant turns before intent-only chat metadata. */
  resolvedReferences?: ProjectMessageResolvedReference[];
  /** Local tips shown on clarification / failure / zero-change turns. */
  guidanceHints?: string[];
  ambiguityReasons?: string[];
}

export interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ProjectMessageMetadata;
  imagePreviews?: string[];
  isError?: boolean;
  isClarification?: boolean;
  suggestedReplies?: string[];
  errorTrace?: string;
  errorStage?: string;
  errorJobId?: string;
  selectedTarget?: SelectedTargetInput;
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  outcome?: ProjectChatOutcome;
  guidanceHints?: string[];
}

export function normalizeAttachmentRefs(
  attachments: WorkspaceAssetAttachment[] = []
): ProjectMessageAttachmentRef[] {
  return attachments
    .map((item) => ({
      id: String(item.id || ''),
      path: String(item.path || ''),
      previewUrl: String(item.previewUrl || item.publicUrl || ''),
      publicUrl: String(item.publicUrl || ''),
      mimeType: String(item.mimeType || 'application/octet-stream'),
      size: Number(item.size) || 0,
      originalName: String(item.originalName || 'asset'),
    }))
    .filter((item) => item.path && item.publicUrl);
}

export function mapMessageForApi(args: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: ProjectMessageMetadata;
}): ChatApiMessage {
  const metadata = args.metadata;
  return {
    role: args.role,
    content: args.content,
    timestamp: args.createdAt,
    metadata,
    imagePreviews: metadata?.attachments?.map((item) => item.previewUrl).filter(Boolean),
    isError: metadata?.outcome === 'failure',
    isClarification: metadata?.outcome === 'clarification',
    suggestedReplies: metadata?.suggestedReplies,
    errorTrace: metadata?.errorTraceExcerpt,
    errorStage: metadata?.errorStage,
    errorJobId: metadata?.editJobId,
    selectedTarget: metadata?.selectedTarget,
    arize: metadata?.arize,
    observability: metadata?.observability,
    outcome: metadata?.outcome,
    guidanceHints: metadata?.guidanceHints,
  };
}

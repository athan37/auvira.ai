import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import type { EditFocusStack } from '@/lib/project-workspace/edit-shared/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

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

export interface ProjectMessageObservabilityMetadata {
  experimentVariant?: string;
  coachingHintCount?: number;
  coachingApplied?: boolean;
}

/** Target locked while awaiting owner clarification on a multi-turn edit. */
export interface ClarificationAnchor {
  kind: 'hero' | 'section';
  sectionIndex?: number;
  title?: string;
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
  };
}

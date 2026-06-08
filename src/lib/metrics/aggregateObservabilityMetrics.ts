import { connectMongoDB } from '@/lib/mongodb';
import { ProjectMessage } from '@/models/ProjectMessage';
import type {
  ProjectChatOutcome,
  ProjectMessageArizeMetadata,
  ProjectMessageMetadata,
} from '@/lib/chat/projectMessageMetadata';

export interface ObservabilityTurnRow {
  projectId: string;
  messageAt: string;
  grade?: string;
  overallScore?: number;
  externalId?: string;
  syncStatus: string;
  experimentVariant?: string;
  flowType?: string;
}

export interface ObservabilityAdminSummary {
  syncedCount: number;
  failedSyncCount: number;
  averageScore: number | null;
  gradeCounts: Record<string, number>;
  recentTurns: ObservabilityTurnRow[];
}

export interface ProjectObservabilityTurnRow {
  messageAt: string;
  outcome?: ProjectChatOutcome;
  replyPreview?: string;
  grade?: string;
  overallScore?: number;
  externalId?: string;
  syncStatus: string;
  experimentVariant?: string;
  coachingHints?: string[];
  guidanceHints?: string[];
  changedFilesCount: number;
  plannerPath?: string;
}

export interface ProjectObservabilitySummary {
  syncedCount: number;
  failedSyncCount: number;
  averageScore: number | null;
  gradeCounts: Record<string, number>;
  outcomeCounts: Record<ProjectChatOutcome, number>;
  coachingAppliedCount: number;
  clarificationCount: number;
}

export interface ProjectObservabilityMetrics {
  summary: ProjectObservabilitySummary;
  turns: ProjectObservabilityTurnRow[];
}

function excerpt(text: string | undefined, maxLen = 120): string | undefined {
  if (!text?.trim()) return undefined;
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

/**
 * Aggregate Arize turn metadata from recent assistant messages.
 */
export async function aggregateObservabilityMetrics(options: {
  days?: number;
  limit?: number;
}): Promise<ObservabilityAdminSummary> {
  await connectMongoDB();
  const days = Math.max(1, options.days ?? 7);
  const limit = Math.min(100, Math.max(10, options.limit ?? 50));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const messages = await ProjectMessage.find({
    role: 'assistant',
    createdAt: { $gte: since },
    'metadata.arize': { $exists: true },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('projectId createdAt metadata.arize metadata.observability')
    .lean();

  let syncedCount = 0;
  let failedSyncCount = 0;
  const scores: number[] = [];
  const gradeCounts: Record<string, number> = {};
  const recentTurns: ObservabilityTurnRow[] = [];

  for (const msg of messages) {
    const arize = msg.metadata?.arize as ProjectMessageArizeMetadata | undefined;
    if (!arize) continue;

    if (arize.syncStatus === 'synced') syncedCount += 1;
    if (arize.syncStatus === 'failed') failedSyncCount += 1;

    if (typeof arize.overallScore === 'number') scores.push(arize.overallScore);
    if (arize.grade) gradeCounts[arize.grade] = (gradeCounts[arize.grade] ?? 0) + 1;

    recentTurns.push({
      projectId: String(msg.projectId),
      messageAt: new Date(msg.createdAt).toISOString(),
      grade: arize.grade,
      overallScore: arize.overallScore,
      externalId: arize.externalId,
      syncStatus: arize.syncStatus,
      experimentVariant: msg.metadata?.observability?.experimentVariant,
      flowType: (msg.metadata?.observability as { flowType?: string } | undefined)?.flowType,
    });
  }

  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return {
    syncedCount,
    failedSyncCount,
    averageScore,
    gradeCounts,
    recentTurns,
  };
}

/**
 * Aggregate Arize turn metadata for a single project from recent assistant messages.
 */
export async function aggregateProjectObservabilityMetrics(options: {
  projectId: string;
  days?: number;
  limit?: number;
}): Promise<ProjectObservabilityMetrics> {
  await connectMongoDB();
  const days = Math.max(1, options.days ?? 7);
  const limit = Math.min(100, Math.max(10, options.limit ?? 50));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const messages = await ProjectMessage.find({
    projectId: options.projectId,
    role: 'assistant',
    createdAt: { $gte: since },
    'metadata.arize': { $exists: true },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('createdAt content metadata')
    .lean();

  let syncedCount = 0;
  let failedSyncCount = 0;
  let coachingAppliedCount = 0;
  let clarificationCount = 0;
  const scores: number[] = [];
  const gradeCounts: Record<string, number> = {};
  const outcomeCounts: Record<ProjectChatOutcome, number> = {
    success: 0,
    clarification: 0,
    failure: 0,
  };
  const turns: ProjectObservabilityTurnRow[] = [];

  for (const msg of messages) {
    const metadata = msg.metadata as ProjectMessageMetadata | undefined;
    const arize = metadata?.arize as ProjectMessageArizeMetadata | undefined;
    if (!arize) continue;

    if (arize.syncStatus === 'synced') syncedCount += 1;
    if (arize.syncStatus === 'failed') failedSyncCount += 1;

    if (typeof arize.overallScore === 'number') scores.push(arize.overallScore);
    if (arize.grade) gradeCounts[arize.grade] = (gradeCounts[arize.grade] ?? 0) + 1;

    const outcome = metadata?.outcome;
    if (outcome && outcome in outcomeCounts) {
      outcomeCounts[outcome] += 1;
    }
    if (outcome === 'clarification') clarificationCount += 1;
    if (metadata?.observability?.coachingApplied) coachingAppliedCount += 1;

    turns.push({
      messageAt: new Date(msg.createdAt).toISOString(),
      outcome,
      replyPreview: excerpt(msg.content),
      grade: arize.grade,
      overallScore: arize.overallScore,
      externalId: arize.externalId,
      syncStatus: arize.syncStatus,
      experimentVariant: metadata?.observability?.experimentVariant,
      coachingHints: metadata?.observability?.coachingHints,
      guidanceHints: metadata?.guidanceHints,
      changedFilesCount: metadata?.changedFiles?.length ?? 0,
      plannerPath: (metadata?.observability as { plannerPath?: string } | undefined)?.plannerPath,
    });
  }

  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return {
    summary: {
      syncedCount,
      failedSyncCount,
      averageScore,
      gradeCounts,
      outcomeCounts,
      coachingAppliedCount,
      clarificationCount,
    },
    turns,
  };
}

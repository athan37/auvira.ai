import { connectMongoDB } from '@/lib/mongodb';
import { ProjectMessage } from '@/models/ProjectMessage';
import type { ProjectMessageArizeMetadata } from '@/lib/chat/projectMessageMetadata';

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

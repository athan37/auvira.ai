import { connectMongoDB } from '@/lib/mongodb';
import { ProjectEditJob } from '@/models/ProjectEditJob';
import { buildEditTimingFromLogs } from '@/lib/project-workspace/editTimingShared';
import { computePercentilesFromValues } from '@/lib/metrics/percentileUtils';

export interface PhasePercentiles {
  phase: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
}

export interface EditMetricsSummary {
  jobCount: number;
  totalMs: PhasePercentiles | null;
  byPhase: PhasePercentiles[];
  slowestPhaseCounts: Record<string, number>;
}

function computePercentiles(values: number[]): { p50Ms: number; p95Ms: number } {
  return computePercentilesFromValues(values);
}

/**
 * Aggregate edit job timing logs for the last N days (owner-scoped or global).
 */
export async function aggregateEditMetrics(options: {
  days?: number;
  limit?: number;
  userId?: string;
}): Promise<EditMetricsSummary> {
  await connectMongoDB();
  const days = Math.max(1, options.days ?? 7);
  const limit = Math.min(500, Math.max(10, options.limit ?? 200));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query: Record<string, unknown> = { createdAt: { $gte: since } };
  if (options.userId) query.userId = options.userId;

  const jobs = await ProjectEditJob.find(query)
    .select('logs createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const totals: number[] = [];
  const phaseDurations = new Map<string, number[]>();
  const slowestCounts: Record<string, number> = {};

  for (const job of jobs) {
    const timing = buildEditTimingFromLogs(
      (job.logs ?? []).map((l: { type: string; createdAt: Date; metadata?: Record<string, unknown> }) => ({
        type: l.type,
        createdAt: l.createdAt,
        metadata: l.metadata,
      }))
    );
    if (timing.totalMs != null) totals.push(timing.totalMs);
    if (timing.slowestPhase) {
      slowestCounts[timing.slowestPhase] = (slowestCounts[timing.slowestPhase] ?? 0) + 1;
    }
    for (const phase of timing.phases) {
      const list = phaseDurations.get(phase.phase) ?? [];
      list.push(phase.durationMs);
      phaseDurations.set(phase.phase, list);
    }
  }

  const byPhase: PhasePercentiles[] = [...phaseDurations.entries()]
    .map(([phase, values]) => ({
      phase,
      count: values.length,
      ...computePercentiles(values),
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms);

  return {
    jobCount: jobs.length,
    totalMs:
      totals.length > 0
        ? { phase: 'total', count: totals.length, ...computePercentiles(totals) }
        : null,
    byPhase,
    slowestPhaseCounts: slowestCounts,
  };
}

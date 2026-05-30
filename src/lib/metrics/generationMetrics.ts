import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteProject } from '@/models/WebsiteProject';
import { CloneJob } from '@/lib/db/models/CloneJob';

export interface GenerationMetricsSummary {
  projectsWithBuildGateSkipped: number;
  projectsWithBuildGatePassed: number;
  projectsWithBuildGateFailed: number;
  cloneJobsPreviewReady: number;
  cloneJobsBuildGateSkipped: number;
  avgCloneBuildDurationMs: number | null;
}

/**
 * Summarize generation funnel metrics: build gate outcomes and clone job preview stats.
 */
export async function aggregateGenerationMetrics(options: {
  days?: number;
}): Promise<GenerationMetricsSummary> {
  await connectMongoDB();
  const days = Math.max(1, options.days ?? 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const projects = await WebsiteProject.find({ createdAt: { $gte: since } })
    .select('generatedSiteValidation')
    .lean();

  let projectsWithBuildGateSkipped = 0;
  let projectsWithBuildGatePassed = 0;
  let projectsWithBuildGateFailed = 0;

  for (const p of projects) {
    const v = p.generatedSiteValidation as { ok?: boolean; buildGateSkipped?: boolean } | undefined;
    if (!v) continue;
    if (v.buildGateSkipped) projectsWithBuildGateSkipped += 1;
    else if (v.ok) projectsWithBuildGatePassed += 1;
    else projectsWithBuildGateFailed += 1;
  }

  const cloneJobs = await CloneJob.find({
    updatedAt: { $gte: since },
    status: { $in: ['preview_ready', 'completed', 'building', 'deploying'] },
  })
    .select('status preview buildValidation')
    .lean();

  let cloneJobsPreviewReady = 0;
  let cloneJobsBuildGateSkipped = 0;
  const buildDurations: number[] = [];

  for (const job of cloneJobs) {
    if (job.status === 'preview_ready' || job.status === 'completed') cloneJobsPreviewReady += 1;
    const bv = job.buildValidation as { buildGateSkipped?: boolean; durationMs?: number } | undefined;
    if (bv?.buildGateSkipped) cloneJobsBuildGateSkipped += 1;
    if (typeof bv?.durationMs === 'number') buildDurations.push(bv.durationMs);
  }

  const avgCloneBuildDurationMs =
    buildDurations.length > 0
      ? Math.round(buildDurations.reduce((a, b) => a + b, 0) / buildDurations.length)
      : null;

  return {
    projectsWithBuildGateSkipped,
    projectsWithBuildGatePassed,
    projectsWithBuildGateFailed,
    cloneJobsPreviewReady,
    cloneJobsBuildGateSkipped,
    avgCloneBuildDurationMs,
  };
}

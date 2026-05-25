import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import mongoose from 'mongoose';
import { getCloneJobDisplayProgress } from '@/lib/clone/cloneJobDisplayProgress';

const IN_PROGRESS_STATUSES = [
  'queued',
  'crawling',
  'extracting',
  'planning',
  'review_ready',
  'preview_building',
  'preview_ready',
  'building',
  'deploying',
];

/** Lists in-progress clone jobs for the current owner (dashboard resume). */
export async function GET() {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const jobs = await CloneJob.find({
    ownerId: new mongoose.Types.ObjectId(authResult.userId),
    status: { $in: IN_PROGRESS_STATUSES },
  })
    .select('_id sourceUrl projectName status currentStageLabel progressPercent updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    ok: true,
    jobs: jobs.map((j) => ({
      id: (j._id as mongoose.Types.ObjectId).toString(),
      sourceUrl: j.sourceUrl,
      projectName: j.projectName,
      status: j.status,
      currentStageLabel: j.currentStageLabel,
      progressPercent: getCloneJobDisplayProgress(j.status, j.progressPercent),
      updatedAt: j.updatedAt,
      continueUrl: `/clone/jobs/${(j._id as mongoose.Types.ObjectId).toString()}`,
    })),
  });
}

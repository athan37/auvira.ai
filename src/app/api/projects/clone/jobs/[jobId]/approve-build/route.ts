import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, PREVIEW_STEPS } from '@/lib/db/models/CloneJob';
import mongoose from 'mongoose';

export async function POST(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  const job = await CloneJob.findOne({
    _id: new mongoose.Types.ObjectId(params.jobId),
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  if (!job) {
    return NextResponse.json(
      { ok: false, stage: 'job_not_found', message: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (job.status !== 'review_ready') {
    return NextResponse.json({
      ok: false,
      error: `Cannot approve build. Job status is "${job.status}", expected "review_ready".`,
    }, { status: 400 });
  }

  // Initialize preview steps (owner-friendly steps, not file paths)
  const previewSteps = PREVIEW_STEPS.map(s => ({
    key: s.key,
    label: s.label,
    status: 'pending' as const,
  }));

  await CloneJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: 'preview_building',
        currentStageLabel: 'Building preview...',
        progressPercent: 10,
        previewSteps,
        preview: { status: 'building' },
      },
      $push: {
        logs: { timestamp: new Date(), stage: 'preview_building', message: 'User approved — building preview' },
      },
    }
  );

  return NextResponse.json({
    ok: true,
    jobId: job._id.toString(),
    status: 'preview_building',
  });
}
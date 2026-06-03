import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { getDefaultLayoutStarter, getLayoutStarter } from '@/lib/builder/layoutStarters';
import mongoose from 'mongoose';

/** Owner overrides layout starter before build preview. */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json();
  const { layoutStarterId } = body as { layoutStarterId?: string };

  if (!layoutStarterId) {
    return NextResponse.json({ ok: false, error: 'layoutStarterId is required' }, { status: 400 });
  }

  const starter = getLayoutStarter(layoutStarterId) ?? getDefaultLayoutStarter();

  const job = await CloneJob.findOne({
    _id: new mongoose.Types.ObjectId(params.jobId),
    ownerId: new mongoose.Types.ObjectId(authResult.userId),
    status: 'review_ready',
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: 'Job not found or not in review state' }, { status: 404 });
  }

  const existing = job.suggestedTemplate ?? {
    category: 'general-service',
    variant: 'modern-clean',
  };

  job.suggestedTemplate = {
    ...existing,
    layoutStarterId: starter.id,
  };
  await job.save();

  return NextResponse.json({
    ok: true,
    suggestedTemplate: job.suggestedTemplate,
  });
}

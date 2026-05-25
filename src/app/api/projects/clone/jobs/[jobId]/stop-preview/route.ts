import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

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

  if (!job.preview?.port) {
    return NextResponse.json({ ok: false, error: 'No preview server running.' }, { status: 400 });
  }

  await stopPreviewServerByPort(job.preview.port);
  await CloneJob.updateOne(
    { _id: job._id },
    { $set: { 'preview.status': 'stopped' } }
  );

  return NextResponse.json({ ok: true, message: 'Preview server stopped.' });
}
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';
import mongoose from 'mongoose';

/** Owner overrides suggested template before build preview. */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json();
  const { category, variant, reason } = body;

  if (!category || !variant) {
    return NextResponse.json({ ok: false, error: 'category and variant are required' }, { status: 400 });
  }

  const normalized = normalizeTemplateSelection(category, variant);

  const job = await CloneJob.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(params.jobId),
      ownerId: new mongoose.Types.ObjectId(authResult.userId),
      status: 'review_ready',
    },
    {
      $set: {
        suggestedTemplate: {
          category: normalized.category,
          variant: normalized.variant,
          reason: reason || OWNER_TEMPLATE_REASON,
        },
      },
    },
    { new: true }
  );

  if (!job) {
    return NextResponse.json({ ok: false, error: 'Job not found or not in review state' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    suggestedTemplate: job.suggestedTemplate,
  });
}

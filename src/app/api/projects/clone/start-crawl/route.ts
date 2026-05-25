import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';
import { CloneJob } from '@/lib/db/models/CloneJob';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const { url, projectName, templateCategory, templateVariant } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
    }

    let suggestedTemplate: { category: string; variant: string; reason: string } | undefined;
    if (templateCategory && templateVariant) {
      const normalized = normalizeTemplateSelection(templateCategory, templateVariant);
      suggestedTemplate = {
        category: normalized.category,
        variant: normalized.variant,
        reason: OWNER_TEMPLATE_REASON,
      };
    }

    const job = new CloneJob({
      ownerId: new mongoose.Types.ObjectId(userId),
      sourceUrl: url,
      projectName: projectName || '',
      status: 'queued',
      currentStageLabel: 'Preparing crawl...',
      progressPercent: 0,
      crawlPages: [],
      logs: [],
      ...(suggestedTemplate ? { suggestedTemplate } : {}),
    });

    await job.save();

    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      reviewUrl: `/clone/jobs/${job._id}`,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: `Failed to start clone job: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}
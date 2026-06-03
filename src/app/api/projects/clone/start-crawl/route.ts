import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { buildCloneSuggestedTemplate } from '@/lib/clone/cloneTemplateSelection';
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
    const { url, projectName, templateCategory, templateVariant, layoutStarterId } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
    }

    const suggestedTemplate =
      templateCategory && templateVariant
        ? buildCloneSuggestedTemplate({
            templateCategory,
            templateVariant,
            layoutStarterId,
            themeOwnerSelected: true,
          })
        : layoutStarterId
        ? buildCloneSuggestedTemplate({ layoutStarterId })
        : undefined;

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
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import { saveClonePreviewToGitLab } from '@/lib/clone/persistClonePreview';

export const runtime = 'nodejs';

/**
 * Save clone preview to GitLab and create (or update) a WebsiteProject.
 * Does not deploy to Vercel — use deploy-preview for that.
 */
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
      { ok: false, error: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (job.status !== 'preview_ready') {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot save preview — job is in '${job.status}' state. Build the preview first.`,
        status: job.status,
      },
      { status: 400 }
    );
  }

  try {
    const result = await saveClonePreviewToGitLab(job, userId);

    return NextResponse.json({
      ok: true,
      projectId: result.project._id.toString(),
      created: result.created,
      gitlab: {
        projectId: result.gitlabProjectId,
        repoUrl: result.repoUrl,
      },
      message: result.created
        ? 'Project saved to GitLab. You can continue editing from your dashboard.'
        : 'Latest preview changes saved to GitLab.',
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await CloneJob.updateOne(
      { _id: job._id },
      { $push: { logs: { timestamp: new Date(), stage: 'save_failed', message: errMsg } } }
    );
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}

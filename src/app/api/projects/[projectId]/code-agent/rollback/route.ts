import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectEditJob } from '@/models/ProjectEditJob';
import { appendEditJobLog, markEditJobStatus } from '@/lib/project-workspace/editJobLogger';
import { restoreDirectorySnapshot } from '@/lib/project-workspace/snapshotManager';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.projectId;
  const project = await WebsiteProject.findOne({ _id: projectId, ownerId: userId });
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedJobId = body.jobId as string | undefined;

  let job = requestedJobId
    ? await ProjectEditJob.findOne({ _id: requestedJobId, projectId, userId, status: 'ready' })
    : await ProjectEditJob.findOne({ projectId, userId, status: 'ready' }).sort({ createdAt: -1 });

  if (!job) {
    return NextResponse.json(
      { ok: false, error: 'No ready edit job found to undo.' },
      { status: 404 }
    );
  }

  if (!job.snapshotPath || !job.workspacePath) {
    return NextResponse.json(
      { ok: false, error: 'This edit has no snapshot available for rollback.' },
      { status: 400 }
    );
  }

  const jobId = job._id.toString();

  await appendEditJobLog(jobId, 'revert_started', 'Restoring workspace from snapshot');

  const restored = await restoreDirectorySnapshot(job.workspacePath, job.snapshotPath);
  if (!restored) {
    await appendEditJobLog(jobId, 'revert_done', 'Revert failed', { success: false });
    return NextResponse.json({ ok: false, error: 'Failed to restore snapshot.' }, { status: 500 });
  }

  await markEditJobStatus(jobId, 'reverted');
  await appendEditJobLog(jobId, 'revert_done', 'Workspace restored from snapshot', { success: true });

  const newVersion = (project.codeWorkspace?.version || 1) + 1;

  const newerReady = await ProjectEditJob.countDocuments({
    projectId,
    status: 'ready',
    createdAt: { $gt: job.createdAt },
  });

  const hasUnpublished = newerReady > 0;

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.version': newVersion,
        hasUnpublishedChanges: hasUnpublished,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    jobId,
    previewVersion: newVersion,
    hasUnpublishedChanges: hasUnpublished,
  });
}

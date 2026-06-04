import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getProjectActorUserId } from '@/lib/api/projectAccess';
import {
  bootstrapProjectPreview,
  checkPreviewHealthy,
  checkProjectWorkspacePreviewHealthy,
  getWorkspaceStatusFromProject,
} from '@/lib/project-workspace/bootstrapProjectPreview';
import { checkPreviewUrlHealthy } from '@/lib/preview/waitForPreviewReady';
import { pruneExpiredScratch } from '@/lib/runtime/scratchCleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Clone GitLab repo, install deps if needed, and start dev preview server.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  void pruneExpiredScratch().catch((err) => {
    console.warn('[workspace/bootstrap] TTL prune failed:', err);
  });

  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const status = getWorkspaceStatusFromProject(project);

  if (status.ready && status.previewMode === 'sandbox' && status.liveUrl) {
    const healthy = await checkPreviewUrlHealthy(status.liveUrl);
    if (healthy) {
      return NextResponse.json({ ok: true, ...status, reused: true });
    }
  }

  if (status.ready && status.previewPort) {
    const healthy = await checkProjectWorkspacePreviewHealthy(project);
    if (healthy) {
      return NextResponse.json({ ok: true, ...status, reused: true });
    }
  } else if (status.previewPort) {
    const healthy = await checkPreviewHealthy(status.previewPort);
    if (!healthy) {
      console.warn(
        `[bootstrap] Unhealthy preview port ${status.previewPort} for ${params.projectId}`
      );
    }
  }

  const userId = await getProjectActorUserId(project);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await bootstrapProjectPreview(project, userId);
    const updated = await getOwnerProject(params.projectId);
    const finalStatus = updated
      ? getWorkspaceStatusFromProject(updated)
      : { ...status, ready: true, stage: 'ready' as const };

    return NextResponse.json({ ok: true, ...finalStatus, reused: false });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Workspace setup failed';
    return NextResponse.json({ ok: false, error: errMsg, stage: 'failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import {
  bootstrapProjectPreview,
  checkPreviewHealthy,
  getWorkspaceStatusFromProject,
} from '@/lib/project-workspace/bootstrapProjectPreview';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Clone GitLab repo, install deps if needed, and start dev preview server.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const status = getWorkspaceStatusFromProject(project);
  if (status.ready && status.previewPort) {
    const healthy = await checkPreviewHealthy(status.previewPort);
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

  const userId = await getServerUserId();
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

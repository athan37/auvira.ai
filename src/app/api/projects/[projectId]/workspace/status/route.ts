import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import {
  checkPreviewHealthy,
  getWorkspaceStatusFromProject,
} from '@/lib/project-workspace/bootstrapProjectPreview';
import { checkPreviewUrlHealthy } from '@/lib/sandbox/bootstrapProjectSandbox';

export async function GET(
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

  if (status.ready && status.previewMode === 'sandbox' && status.liveUrl) {
    const healthy = await checkPreviewUrlHealthy(status.liveUrl);
    if (!healthy) {
      return NextResponse.json({
        ok: true,
        ...status,
        ready: false,
        stage: 'starting_server',
        label: 'Dev preview stopped responding — reopen to restart',
        previewHealthy: false,
      });
    }
    return NextResponse.json({ ok: true, ...status, previewHealthy: true });
  }

  if (status.ready && status.previewPort) {
    const healthy = await checkPreviewHealthy(status.previewPort);
    if (!healthy) {
      return NextResponse.json({
        ok: true,
        ...status,
        ready: false,
        stage: 'starting_server',
        label: 'Preview server stopped responding — restart required',
        previewHealthy: false,
      });
    }
    return NextResponse.json({ ok: true, ...status, previewHealthy: true });
  }

  return NextResponse.json({ ok: true, ...status, previewHealthy: status.ready });
}

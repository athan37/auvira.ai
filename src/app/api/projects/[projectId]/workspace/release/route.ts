import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';
import {
  pruneExpiredScratch,
  releaseProjectScratch,
} from '@/lib/runtime/scratchCleanup';
import { WebsiteProject } from '@/models/WebsiteProject';

export const runtime = 'nodejs';

/**
 * Release on-disk scratch for a project when the owner leaves the editor.
 * Also runs a best-effort TTL prune across all scratch dirs.
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

  const projectId = params.projectId;

  if (!isVercelServerless() && project.preview?.port) {
    await stopPreviewServerByPort(project.preview.port).catch(() => {});
  }

  const { removed } = await releaseProjectScratch(projectId);

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'preview.status': 'stopped',
        'codeWorkspace.setupStage': 'idle',
        'codeWorkspace.setupLabel': 'Workspace released',
      },
    }
  ).catch(() => {});

  void pruneExpiredScratch().catch((err) => {
    console.warn('[workspace/release] TTL prune failed:', err);
  });

  return NextResponse.json({ ok: true, removed });
}

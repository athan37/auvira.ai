import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';

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

  if (project.preview?.port) {
    await stopPreviewServerByPort(project.preview.port);
  }

  await WebsiteProject.updateOne({ _id: project._id }, {
    $set: { 'preview.status': 'stopped' },
  });

  return NextResponse.json({ ok: true });
}
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { ProjectMessage } from '@/models/ProjectMessage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, stage: 'project_not_found', message: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const messages = await ProjectMessage.find({ projectId: project._id })
    .select('role content metadata createdAt')
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({
    ok: true,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      metadata: m.metadata,
    })),
  });
}
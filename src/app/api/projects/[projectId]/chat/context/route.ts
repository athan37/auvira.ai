import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { buildConversationHistory, listProjectMessages } from '@/lib/chat/projectChatService';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, stage: 'project_not_found', message: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '');
  const maxTurnsParam = Number(request.nextUrl.searchParams.get('maxTurns') || '');
  const messages = await listProjectMessages({
    projectId: project._id,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
  });
  const conversationHistory = await buildConversationHistory({
    projectId: project._id,
    maxTurns: Number.isFinite(maxTurnsParam) ? maxTurnsParam : 6,
  });

  return NextResponse.json({
    ok: true,
    messages,
    conversationHistory,
  });
}

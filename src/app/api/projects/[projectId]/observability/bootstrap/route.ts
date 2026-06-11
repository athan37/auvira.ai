import { NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import {
  fetchObservabilityHealth,
  listObservabilityConversations,
  type ObservabilityConversationRow,
} from '@/lib/observability/client';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseConversations(
  data: { conversations?: ObservabilityConversationRow[] } | null
): Array<{ id: string; title: string; turnCount?: number }> {
  if (!data?.conversations || !Array.isArray(data.conversations)) return [];
  return data.conversations
    .map((row) => {
      const id = row.conversation_id?.trim();
      if (!id) return null;
      const option: { id: string; title: string; turnCount?: number } = {
        id,
        title: row.title?.trim() || id,
      };
      if (typeof row.turn_count === 'number') {
        option.turnCount = row.turn_count;
      }
      return option;
    })
    .filter((row): row is { id: string; title: string; turnCount?: number } => row != null);
}

/**
 * GET /api/projects/{projectId}/observability/bootstrap — conversations + Monitor health.
 */
export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const monitorEnabled = isObservabilityEnabled();
  const defaultConversationId = editorConversationId(params.projectId);

  if (!monitorEnabled) {
    return NextResponse.json({
      ok: true,
      projectId: params.projectId,
      projectName: project.name ?? 'Project',
      monitorEnabled: false,
      defaultConversationId,
      conversations: [],
      health: null,
      hint: 'Enable Site Monitor to load analytics.',
    });
  }

  const [conversationsResult, healthResult] = await Promise.all([
    listObservabilityConversations(params.projectId),
    fetchObservabilityHealth(),
  ]);

  const conversations = conversationsResult.ok
    ? parseConversations(conversationsResult.data)
    : [];

  return NextResponse.json({
    ok: true,
    projectId: params.projectId,
    projectName: project.name ?? 'Project',
    monitorEnabled: true,
    defaultConversationId,
    conversations,
    conversationsError: conversationsResult.ok
      ? undefined
      : conversationsResult.error ?? 'Failed to list conversations',
    conversationsHint:
      conversations.length === 0
        ? 'No conversations yet. Create via POST /conversations.'
        : undefined,
    health: healthResult.ok ? healthResult.data : null,
    healthError: healthResult.ok ? undefined : healthResult.error,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';
import {
  extractColorFromIntentSentence,
  intentSentenceIsUnresolved,
} from '@/lib/observability/intentSentence';
import { serializeSelectedTargetForMonitor } from '@/lib/observability/serializeTurnContext';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSelectedTarget(raw: string | null): SelectedTargetInput | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as SelectedTargetInput;
    return parsed?.kind ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/projects/{projectId}/observability/intent — replay Monitor POST /intent for a message.
 * Used by the observability dashboard to show extracted color/intent per turn.
 */
export async function GET(
  request: NextRequest,
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

  if (!isObservabilityEnabled()) {
    return NextResponse.json({ ok: false, error: 'Site Monitor is not enabled' }, { status: 503 });
  }

  const userMessage = request.nextUrl.searchParams.get('userMessage')?.trim() ?? '';
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: 'userMessage is required' }, { status: 400 });
  }

  const selectedTarget = parseSelectedTarget(
    request.nextUrl.searchParams.get('selectedTarget')
  );

  const intent = await fetchObservabilityIntent({
    projectId: params.projectId,
    userMessage,
    selectedTarget,
    conversationId: editorConversationId(params.projectId),
  });

  const sentence = intent?.sentence?.trim();
  if (!sentence) {
    return NextResponse.json({
      ok: true,
      sentence: null,
      extractedColor: null,
      unresolved: true,
      selectedTarget: serializeSelectedTargetForMonitor(selectedTarget) ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    sentence,
    extractedColor: extractColorFromIntentSentence(sentence),
    unresolved: intentSentenceIsUnresolved(sentence),
    selectedTarget: serializeSelectedTargetForMonitor(selectedTarget) ?? null,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';
import {
  extractColorsFromIntentSentence,
  intentSentenceIsUnresolved,
} from '@/lib/observability/intentSentence';
import { serializeSelectedTargetForMonitor } from '@/lib/observability/serializeTurnContext';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseSelectedTarget(raw: unknown): SelectedTargetInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as SelectedTargetInput;
  return parsed?.kind ? parsed : null;
}

function intentResponse(input: {
  sentence: string | null;
  unresolved: boolean;
  selectedTarget: Record<string, unknown> | null;
  error?: string;
}) {
  const extractedColors = input.sentence
    ? extractColorsFromIntentSentence(input.sentence)
    : [];
  return NextResponse.json({
    ok: !input.error,
    intent: input.sentence,
    sentence: input.sentence,
    extractedColor: extractedColors[extractedColors.length - 1] ?? null,
    extractedColors,
    unresolved: input.unresolved,
    selectedTarget: input.selectedTarget,
    error: input.error,
  });
}

/**
 * GET /api/projects/{projectId}/observability/intent — turn-table intent lookup.
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

  let selectedTarget: SelectedTargetInput | null = null;
  const selectedTargetRaw = request.nextUrl.searchParams.get('selectedTarget');
  if (selectedTargetRaw?.trim()) {
    try {
      selectedTarget = parseSelectedTarget(JSON.parse(selectedTargetRaw));
    } catch {
      selectedTarget = null;
    }
  }

  const conversationId =
    request.nextUrl.searchParams.get('conversationId')?.trim() ||
    editorConversationId(params.projectId);

  const intent = await fetchObservabilityIntent({
    projectId: params.projectId,
    userMessage,
    selectedTarget,
    conversationId,
  });
  const sentence = intent?.sentence?.trim() ?? null;

  return intentResponse({
    sentence,
    unresolved: sentence ? intentSentenceIsUnresolved(sentence) : true,
    selectedTarget: serializeSelectedTargetForMonitor(selectedTarget) ?? null,
  });
}

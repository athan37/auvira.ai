import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { fetchObservabilityIntentDetailed } from '@/lib/observability/client';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { fetchObservabilityIntent, parseObservabilityProjectIntent } from '@/lib/observability/fetchObservabilityIntent';
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

function probeResponse(input: {
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

async function resolveIntentProbe(input: {
  projectId: string;
  userMessage: string;
  conversationId: string;
  selectedTarget: SelectedTargetInput | null;
  useDetailedFetch: boolean;
}) {
  if (input.useDetailedFetch) {
    const result = await fetchObservabilityIntentDetailed({
      projectId: input.projectId,
      body: {
        user_message: input.userMessage,
        conversation_id: input.conversationId,
        selected_target: serializeSelectedTargetForMonitor(input.selectedTarget) ?? null,
      },
    });

    if (!result.ok) {
      return {
        sentence: null,
        unresolved: true,
        error: result.error ?? 'Intent probe failed',
      };
    }

    const parsed = result.data ? parseObservabilityProjectIntent(result.data) : null;
    const sentence = parsed?.sentence?.trim() ?? null;
    return {
      sentence,
      unresolved: sentence ? intentSentenceIsUnresolved(sentence) : true,
      error: sentence ? undefined : 'Intent probe returned no sentence',
    };
  }

  const intent = await fetchObservabilityIntent({
    projectId: input.projectId,
    userMessage: input.userMessage,
    selectedTarget: input.selectedTarget,
    conversationId: input.conversationId,
  });
  const sentence = intent?.sentence?.trim() ?? null;
  return {
    sentence,
    unresolved: sentence ? intentSentenceIsUnresolved(sentence) : true,
    error: undefined,
  };
}

/**
 * POST /api/projects/{projectId}/observability/intent — on-demand Monitor POST /intent probe.
 */
export async function POST(
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

  let body: {
    userMessage?: string;
    conversationId?: string;
    selectedTarget?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const userMessage = body.userMessage?.trim() ?? '';
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: 'userMessage is required' }, { status: 400 });
  }

  const conversationId =
    body.conversationId?.trim() || editorConversationId(params.projectId);
  const selectedTarget = parseSelectedTarget(body.selectedTarget);

  const result = await resolveIntentProbe({
    projectId: params.projectId,
    userMessage,
    conversationId,
    selectedTarget,
    useDetailedFetch: true,
  });

  if (result.error && !result.sentence) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    );
  }

  return probeResponse({
    sentence: result.sentence,
    unresolved: result.unresolved,
    selectedTarget: serializeSelectedTargetForMonitor(selectedTarget) ?? null,
    error: result.error,
  });
}

/**
 * GET /api/projects/{projectId}/observability/intent — legacy query probe (turn table cells).
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

  const result = await resolveIntentProbe({
    projectId: params.projectId,
    userMessage,
    conversationId,
    selectedTarget,
    useDetailedFetch: false,
  });

  return probeResponse({
    sentence: result.sentence,
    unresolved: result.unresolved,
    selectedTarget: serializeSelectedTargetForMonitor(selectedTarget) ?? null,
    error: result.error,
  });
}

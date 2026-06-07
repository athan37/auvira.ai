import { postObservabilityTurn } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';
import { mapTurnPayload, type MapTurnPayloadInput } from './mapTurnPayload';
import { redactTurnPayload } from './redactPii';
import type { ObservabilityTurnMetadata } from './types';

export interface RecordObservabilityTurnInput extends MapTurnPayloadInput {
  projectId: string;
  conversationId?: string;
}

function flowTypeFromPlan(plan?: Record<string, unknown>): 'edit' | 'clone' | 'generate' | undefined {
  const raw = plan?.flow_type;
  if (raw === 'edit' || raw === 'clone' || raw === 'generate') return raw;
  return undefined;
}

function coachingHintsForMetadata(
  payload: ReturnType<typeof mapTurnPayload>,
  coachingHints?: string[]
): string[] | undefined {
  if (!payload.coaching_applied) return undefined;
  const hints = coachingHints?.filter((hint) => hint.trim().length > 0) ?? [];
  return hints.length > 0 ? hints : undefined;
}

function metadataFromPayload(
  payload: ReturnType<typeof mapTurnPayload>,
  response: { trace_id?: string; turn_scores?: { grade?: string; overall?: number } } | null,
  coachingHints?: string[]
): ObservabilityTurnMetadata {
  const flowType = flowTypeFromPlan(payload.plan);
  const hints = coachingHintsForMetadata(payload, coachingHints);
  const observability = {
    experimentVariant: payload.experiment_variant,
    coachingHintCount: payload.coaching_hint_count,
    coachingApplied: payload.coaching_applied,
    coachingHints: hints,
    flowType,
  };

  if (!response?.trace_id) {
    return {
      arize: { syncStatus: 'failed' },
      observability,
    };
  }

  return {
    arize: {
      syncStatus: 'synced',
      externalId: response.trace_id,
      syncedAt: new Date().toISOString(),
      grade: response.turn_scores?.grade,
      overallScore: response.turn_scores?.overall,
    },
    observability,
  };
}

/** Record a scored turn to Site Monitor (non-throwing). */
export async function recordObservabilityTurn(
  input: RecordObservabilityTurnInput
): Promise<ObservabilityTurnMetadata | null> {
  if (!isObservabilityEnabled()) return null;

  try {
    const payload = redactTurnPayload(mapTurnPayload(input));
    const conversationId = input.conversationId ?? editorConversationId(input.projectId);
    const response = await postObservabilityTurn({
      projectId: input.projectId,
      conversationId,
      payload,
    });

    return metadataFromPayload(payload, response, input.coachingContext?.coachingHints);
  } catch (error) {
    console.warn('[observability] record turn failed', {
      projectId: input.projectId,
      turnId: input.turnId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return {
      arize: { syncStatus: 'failed' },
    };
  }
}

/** Record a scored edit turn to Site Monitor (non-throwing). */
export async function recordEditTurn(
  input: MapTurnPayloadInput & { projectId: string }
): Promise<ObservabilityTurnMetadata | null> {
  return recordObservabilityTurn(input);
}

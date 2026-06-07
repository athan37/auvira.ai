import { postObservabilityTurn } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';
import { mapTurnPayload, type MapTurnPayloadInput } from './mapTurnPayload';
import { redactTurnPayload } from './redactPii';
import type { ObservabilityTurnMetadata } from './types';

/** Record a scored edit turn to Site Monitor (non-throwing). */
export async function recordEditTurn(
  input: MapTurnPayloadInput & { projectId: string }
): Promise<ObservabilityTurnMetadata | null> {
  if (!isObservabilityEnabled()) return null;

  try {
    const payload = redactTurnPayload(mapTurnPayload(input));
    const response = await postObservabilityTurn({
      projectId: input.projectId,
      conversationId: editorConversationId(input.projectId),
      payload,
    });

    if (!response?.trace_id) {
      return {
        arize: { syncStatus: 'failed' },
        observability: {
          experimentVariant: payload.experiment_variant,
          coachingHintCount: payload.coaching_hint_count,
          coachingApplied: payload.coaching_applied,
        },
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
      observability: {
        experimentVariant: payload.experiment_variant,
        coachingHintCount: payload.coaching_hint_count,
        coachingApplied: payload.coaching_applied,
      },
    };
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

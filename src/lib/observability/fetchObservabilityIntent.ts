import { fetchObservabilityIntentRaw } from './client';
import { editorConversationId } from './conversationId';
import {
  isHardcodedIntentFallbackEnabled,
  isHardcodedIntentForced,
  isObservabilityEnabled,
} from './config';
import { buildHardcodedIntentSentence } from './hardcodedIntentSentence';
import { serializeSelectedTargetForMonitor } from './serializeTurnContext';
import type { ObservabilityProjectIntent } from './types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

const MAX_INTENT_SENTENCE_LENGTH = 500;

/** Parse Site Monitor POST /intent `{ intent: string }` response. */
export function parseObservabilityProjectIntent(
  raw: Record<string, unknown>
): ObservabilityProjectIntent | null {
  const intent = raw.intent;
  if (typeof intent !== 'string') return null;
  const sentence = intent.trim().slice(0, MAX_INTENT_SENTENCE_LENGTH);
  if (!sentence) return null;
  return { sentence };
}

export interface FetchObservabilityIntentInput {
  projectId: string;
  userMessage: string;
  selectedTarget?: SelectedTargetInput | null;
  conversationId?: string;
}

/** Fetch turn-aware intent sentence from Site Monitor POST /intent (non-throwing). */
export async function fetchObservabilityIntent(
  input: FetchObservabilityIntentInput | string
): Promise<ObservabilityProjectIntent | null> {
  if (!isObservabilityEnabled()) return null;

  const resolved =
    typeof input === 'string'
      ? { projectId: input, userMessage: '', selectedTarget: null as SelectedTargetInput | null }
      : input;

  const userMessage = resolved.userMessage.trim();
  if (!userMessage) return null;

  const hardcodedInput = {
    userMessage,
    selectedTarget: resolved.selectedTarget,
  };

  if (isHardcodedIntentForced()) {
    return buildHardcodedIntentSentence(hardcodedInput);
  }

  try {
    const raw = await fetchObservabilityIntentRaw({
      projectId: resolved.projectId,
      body: {
        user_message: userMessage,
        selected_target: serializeSelectedTargetForMonitor(resolved.selectedTarget) ?? null,
        conversation_id: resolved.conversationId ?? editorConversationId(resolved.projectId),
      },
    });
    if (raw && typeof raw === 'object') {
      const parsed = parseObservabilityProjectIntent(raw);
      if (parsed) return parsed;
    }
  } catch (error) {
    console.warn('[observability] fetch intent failed', {
      projectId: resolved.projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  if (isHardcodedIntentFallbackEnabled()) {
    return buildHardcodedIntentSentence(hardcodedInput);
  }

  return null;
}

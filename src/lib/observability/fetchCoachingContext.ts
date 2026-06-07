import { fetchObservabilityContextRaw } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';
import type { ObservabilityCoachingContext } from './types';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseCoachingContext(raw: Record<string, unknown>): ObservabilityCoachingContext {
  return {
    coachingHints: asStringArray(raw.coaching_hints),
    constraints:
      raw.constraints && typeof raw.constraints === 'object'
        ? (raw.constraints as Record<string, unknown>)
        : {},
    qualitySnapshot:
      raw.quality_snapshot && typeof raw.quality_snapshot === 'object'
        ? (raw.quality_snapshot as Record<string, unknown>)
        : {},
    recurringIssues: asStringArray(raw.recurring_issues),
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
  };
}

/** Fetch coaching context from Site Monitor GET /context (non-throwing). */
export async function fetchCoachingContext(input: {
  projectId: string;
  userMessage: string;
}): Promise<ObservabilityCoachingContext | null> {
  if (!isObservabilityEnabled()) return null;

  try {
    const response = await fetchObservabilityContextRaw({
      projectId: input.projectId,
      conversationId: editorConversationId(input.projectId),
      latestUserMessage: input.userMessage,
    });
    if (!response?.context || typeof response.context !== 'object') return null;
    return parseCoachingContext(response.context as Record<string, unknown>);
  } catch (error) {
    console.warn('[observability] fetch context failed', {
      projectId: input.projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

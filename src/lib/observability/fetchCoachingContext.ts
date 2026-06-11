import { fetchObservabilityContextRaw } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';
import type { ObservabilityCoachingContext, ObservabilityQualitySnapshot } from './types';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseQualitySnapshot(raw: unknown): ObservabilityQualitySnapshot {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const latestOverallScore =
    typeof obj.latest_overall_score === 'number' && Number.isFinite(obj.latest_overall_score)
      ? obj.latest_overall_score
      : typeof obj.score === 'number' && Number.isFinite(obj.score)
        ? obj.score
        : undefined;
  const latestGrade =
    typeof obj.latest_grade === 'string'
      ? obj.latest_grade
      : typeof obj.grade === 'string'
        ? obj.grade
        : undefined;

  return {
    trend: typeof obj.trend === 'string' ? obj.trend : undefined,
    latestOverallScore,
    latestGrade,
    score: typeof obj.score === 'number' ? obj.score : undefined,
    grade: typeof obj.grade === 'string' ? obj.grade : undefined,
  };
}

/** Parse Site Monitor GET /context payload into typed coaching context. */
export function parseCoachingContext(raw: Record<string, unknown>): ObservabilityCoachingContext {
  return {
    coachingHints: asStringArray(raw.coaching_hints),
    constraints:
      raw.constraints && typeof raw.constraints === 'object'
        ? (raw.constraints as Record<string, unknown>)
        : {},
    hintPolicy:
      raw.hint_policy && typeof raw.hint_policy === 'object'
        ? (raw.hint_policy as Record<string, unknown>)
        : undefined,
    qualitySnapshot: parseQualitySnapshot(raw.quality_snapshot),
    recurringIssues: asStringArray(raw.recurring_issues),
    missingKeywords: asStringArray(raw.missing_keywords),
    traceCount:
      typeof raw.trace_count === 'number' && Number.isFinite(raw.trace_count)
        ? raw.trace_count
        : undefined,
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

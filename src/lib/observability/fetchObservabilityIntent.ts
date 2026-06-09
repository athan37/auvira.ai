import { fetchObservabilityIntentRaw } from './client';
import { isObservabilityEnabled } from './config';
import type { ObservabilityProjectIntent } from './types';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asIntentEntries(value: unknown): ObservabilityProjectIntent['intents'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const label = typeof (entry as { label?: unknown }).label === 'string'
        ? (entry as { label: string }).label.trim()
        : '';
      const count =
        typeof (entry as { count?: unknown }).count === 'number'
          ? (entry as { count: number }).count
          : 0;
      if (!label) return null;
      return { label, count };
    })
    .filter((entry): entry is { label: string; count: number } => entry != null);
}

/** Parse Site Monitor GET /intent payload into typed project vocabulary. */
export function parseObservabilityProjectIntent(
  raw: Record<string, unknown>
): ObservabilityProjectIntent {
  return {
    keywords: asStringArray(raw.keywords),
    intents: asIntentEntries(raw.intents),
    turn_count: typeof raw.turn_count === 'number' ? raw.turn_count : 0,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

/** Fetch project vocabulary from Site Monitor GET /intent (non-throwing). */
export async function fetchObservabilityIntent(
  projectId: string
): Promise<ObservabilityProjectIntent | null> {
  if (!isObservabilityEnabled()) return null;

  try {
    const raw = await fetchObservabilityIntentRaw(projectId);
    if (!raw || typeof raw !== 'object') return null;
    return parseObservabilityProjectIntent(raw);
  } catch (error) {
    console.warn('[observability] fetch intent failed', {
      projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

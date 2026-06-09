import type {
  ProjectMessageObservabilityMetadata,
  ProjectMessageResolvedReference,
  ProjectMessageVocabulary,
} from '@/lib/chat/projectMessageMetadata';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';
import type { ObservabilityProjectIntent } from './types';

const MAX_VOCAB_KEYWORDS = 10;
const MAX_VOCAB_INTENTS = 5;

function dedupeShort(values: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function sourceLabel(source: ImplicitReferenceRecord['source']): string {
  switch (source) {
    case 'project_intent':
      return 'project vocabulary';
    case 'coaching_context':
      return 'coaching context';
    case 'chat_history':
      return 'project history';
    case 'llm_inference':
      return 'context inference';
    case 'explicit_message':
      return 'explicit message';
    default:
      return source;
  }
}

/** Build capped vocabulary snapshot for chat metadata (skip low-signal). */
export function buildProjectVocabularyForChat(
  intent?: ObservabilityProjectIntent | null
): ProjectMessageVocabulary | undefined {
  if (!intent || intent.turn_count === 0) return undefined;
  const keywords = dedupeShort(intent.keywords, MAX_VOCAB_KEYWORDS);
  const intents = intent.intents
    .filter((entry) => entry.label.trim().length > 0)
    .slice(0, MAX_VOCAB_INTENTS)
    .map((entry) => ({ label: entry.label.trim(), count: entry.count }));
  if (keywords.length === 0 && intents.length === 0) return undefined;
  return {
    keywords,
    intents,
    turnCount: intent.turn_count,
  };
}

/** Build resolved reference rows for chat metadata (resolved values only). */
export function buildResolvedReferencesForChat(
  references?: ImplicitReferenceRecord[] | null
): ProjectMessageResolvedReference[] | undefined {
  if (!references?.length) return undefined;
  const rows = references
    .filter((ref) => ref.resolvedValue?.trim())
    .map((ref) => ({
      phrase: ref.phrase,
      resolvedValue: ref.resolvedValue!.trim(),
      source: sourceLabel(ref.source),
    }));
  return rows.length > 0 ? rows : undefined;
}

export function formatVocabularyPanelLines(
  vocabulary?: ProjectMessageVocabulary | null
): string[] {
  if (!vocabulary) return [];
  const lines: string[] = [];
  if (vocabulary.keywords.length > 0) {
    lines.push(`Recurring topics: ${vocabulary.keywords.join(', ')}`);
  }
  if (vocabulary.intents.length > 0) {
    lines.push(
      `Common edit types: ${vocabulary.intents
        .map((entry) => `${entry.label} (${entry.count})`)
        .join(', ')}`
    );
  }
  return lines;
}

export function formatResolvedReferencePanelLines(
  references?: ProjectMessageResolvedReference[] | null
): string[] {
  if (!references?.length) return [];
  return references.map(
    (ref) => `"${ref.phrase}" → "${ref.resolvedValue}" (${ref.source})`
  );
}

/** Merge planner/resolver context into observability metadata for chat storage. */
export function enrichObservabilityMetadataForChat(
  base: ProjectMessageObservabilityMetadata | undefined,
  input: {
    projectIntent?: ObservabilityProjectIntent | null;
    resolvedReferences?: ImplicitReferenceRecord[] | null;
  }
): ProjectMessageObservabilityMetadata | undefined {
  const vocabulary = buildProjectVocabularyForChat(input.projectIntent);
  const resolved = buildResolvedReferencesForChat(input.resolvedReferences);
  if (!base && !vocabulary && !resolved) return undefined;
  return {
    ...base,
    ...(vocabulary ? { projectVocabulary: vocabulary } : {}),
    ...(resolved ? { resolvedReferences: resolved } : {}),
  };
}

export function countEditContextPanelItems(
  observability?: ProjectMessageObservabilityMetadata | null
): number {
  if (!observability) return 0;
  return (
    formatVocabularyPanelLines(observability.projectVocabulary).length +
    (observability.resolvedReferences?.length ?? 0)
  );
}

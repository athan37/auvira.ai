import type {
  ProjectChatOutcome,
  ProjectMessageMonitorContext,
  ProjectMessageObservabilityMetadata,
  ProjectMessageResolvedReference,
  ProjectMessageVocabulary,
} from '@/lib/chat/projectMessageMetadata';
import {
  hasResolvedReferenceValues,
  type ImplicitReferenceRecord,
} from '@/lib/project-workspace/edit-context/implicitReferenceTypes';
import type { ObservabilityCoachingContext, ObservabilityProjectIntent } from './types';

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
      return 'Project Memory';
    case 'project_memory':
      return 'Project Memory';
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

/** @deprecated Use buildIntentFeedForChat. */
export function buildProjectVocabularyForChat(
  intent?: ObservabilityProjectIntent | null
): ProjectMessageVocabulary | undefined {
  return buildIntentFeedForChat(intent);
}

/** POST /intent sentence snapshot for chat metadata. */
export function buildIntentFeedForChat(
  intent?: ObservabilityProjectIntent | null
): ProjectMessageVocabulary | undefined {
  const sentence = intent?.sentence?.trim();
  if (!sentence) return undefined;
  return { sentence };
}

/** GET /context snapshot fed into planner/resolver for this edit. */
export function buildMonitorContextForChat(
  context?: ObservabilityCoachingContext | null
): ProjectMessageMonitorContext | undefined {
  if (!context) return undefined;
  const constraintKeys = Object.keys(context.constraints);
  const grade = context.qualitySnapshot.latest_grade;
  const score = context.qualitySnapshot.latest_overall_score;
  return {
    source: context.source,
    coachingHints: context.coachingHints
      .map((hint) => hint.trim())
      .filter(Boolean)
      .slice(0, 8),
    recurringIssues: context.recurringIssues
      .map((issue) => issue.trim())
      .filter(Boolean)
      .slice(0, 8),
    constraintSummary: constraintKeys.length > 0 ? constraintKeys.join(', ') : undefined,
    qualityGrade: typeof grade === 'string' ? grade : undefined,
    qualityScore: typeof score === 'number' ? score : undefined,
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

/** Resolved refs persisted on chat only when a successful edit applied them. */
export function buildAppliedProjectMemoryForChat(
  references: ImplicitReferenceRecord[] | null | undefined,
  outcome: ProjectChatOutcome | undefined
): ProjectMessageResolvedReference[] | undefined {
  if (outcome !== 'success') return undefined;
  if (!references?.length || !hasResolvedReferenceValues(references)) return undefined;
  return buildResolvedReferencesForChat(references);
}

export function formatVocabularyPanelLines(
  vocabulary?: ProjectMessageVocabulary | null
): string[] {
  if (!vocabulary) return [];
  if (vocabulary.sentence?.trim()) return [vocabulary.sentence.trim()];
  const lines: string[] = [];
  if (vocabulary.keywords?.length) {
    lines.push(`Recurring topics: ${vocabulary.keywords.join(', ')}`);
  }
  if (vocabulary.intents?.length) {
    lines.push(
      `Common edit types: ${vocabulary.intents
        .map((entry) => `${entry.label} (${entry.count})`)
        .join(', ')}`
    );
  }
  return lines;
}

/** Chat panel lines for POST /intent sentence. */
export function formatIntentFeedPanelLines(
  feed?: ProjectMessageVocabulary | null
): string[] {
  if (!feed) return ['Intent: (none)'];
  if (feed.sentence?.trim()) return [feed.sentence.trim()];
  const vocabLines = formatVocabularyPanelLines(feed);
  if (vocabLines.length > 0) return vocabLines;
  if (feed.turnCount != null) return [`Turn count: ${feed.turnCount}`, 'Intent: (none)'];
  return ['Intent: (none)'];
}

/** Chat panel lines for GET /context feed. */
export function formatMonitorContextPanelLines(
  context?: ProjectMessageMonitorContext | null
): string[] {
  if (!context) return [];
  const lines: string[] = [`Source: ${context.source}`];
  if (context.coachingHints.length > 0) {
    lines.push(...context.coachingHints.map((hint) => `Coaching: ${hint}`));
  } else {
    lines.push('Coaching hints: (none)');
  }
  if (context.recurringIssues.length > 0) {
    lines.push(`Recurring issues: ${context.recurringIssues.join(', ')}`);
  }
  if (context.constraintSummary) {
    lines.push(`Constraints: ${context.constraintSummary}`);
  }
  if (context.qualityGrade) {
    const score =
      context.qualityScore != null ? ` · score ${context.qualityScore.toFixed(2)}` : '';
    lines.push(`Quality: ${context.qualityGrade}${score}`);
  }
  return lines;
}

function resolveIntentFeed(
  observability?: ProjectMessageObservabilityMetadata | null
): ProjectMessageVocabulary | undefined {
  return observability?.intentFeed ?? observability?.projectVocabulary;
}

export function formatResolvedReferencePanelLines(
  references?: ProjectMessageResolvedReference[] | null
): string[] {
  if (!references?.length) return [];
  return references.map(
    (ref) => `"${ref.phrase}" → "${ref.resolvedValue}" (${ref.source})`
  );
}

/** User-facing inline + panel lines for applied project memory (no raw keywords). */
export function formatUsedProjectContextLines(
  references?: ProjectMessageResolvedReference[] | null
): string[] {
  if (!references?.length) return [];
  const arrow = (ref: ProjectMessageResolvedReference) =>
    `"${ref.phrase}" → "${ref.resolvedValue}"`;
  if (references.length === 1) {
    return [`Used project context: ${arrow(references[0])}`];
  }
  return references.map((ref) => `Used project context: ${arrow(ref)}`);
}

export function formatProjectMemoryPanelLines(
  references?: ProjectMessageResolvedReference[] | null
): string[] {
  if (!references?.length) return [];
  return references.map((ref) => `"${ref.phrase}" → "${ref.resolvedValue}"`);
}

/** Merge resolver context into observability metadata for chat storage. */
export function enrichObservabilityMetadataForChat(
  base: ProjectMessageObservabilityMetadata | undefined,
  input: {
    outcome?: ProjectChatOutcome;
    resolvedReferences?: ImplicitReferenceRecord[] | null;
    projectIntent?: ObservabilityProjectIntent | null;
    coachingContext?: ObservabilityCoachingContext | null;
  }
): ProjectMessageObservabilityMetadata | undefined {
  const appliedProjectMemory = buildAppliedProjectMemoryForChat(
    input.resolvedReferences,
    input.outcome
  );
  const intentFeed = buildIntentFeedForChat(input.projectIntent);
  const monitorContext = buildMonitorContextForChat(input.coachingContext);
  if (!base && !appliedProjectMemory && !intentFeed && !monitorContext) return undefined;
  return {
    ...base,
    ...(appliedProjectMemory ? { appliedProjectMemory } : {}),
    ...(intentFeed ? { intentFeed, projectVocabulary: intentFeed } : {}),
    ...(monitorContext ? { monitorContext } : {}),
  };
}

export function countEditContextPanelItems(
  observability?: ProjectMessageObservabilityMetadata | null
): number {
  if (!observability) return 0;
  const feed = resolveIntentFeed(observability);
  const intentLines = feed ? formatIntentFeedPanelLines(feed).length : 0;
  const contextLines = observability.monitorContext
    ? formatMonitorContextPanelLines(observability.monitorContext).length
    : 0;
  return (observability.appliedProjectMemory?.length ?? 0) + intentLines + contextLines;
}

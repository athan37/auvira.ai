import type { ProjectMessageObservabilityMetadata } from '@/lib/chat/projectMessageMetadata';
import {
  formatResolvedReferencePanelLines,
  formatVocabularyPanelLines,
} from './formatEditContextSummary';

export interface CoachingSummaryView {
  label: string;
  hints: string[];
  /** Coaching hints when shown alongside local guidance in one panel. */
  monitorHints?: string[];
  /** Site Monitor /intent vocabulary lines. */
  projectVocabulary?: string[];
  /** Resolved implicit reference lines. */
  resolvedReferences?: string[];
}

function hintCount(observability: ProjectMessageObservabilityMetadata): number {
  const fromList = observability.coachingHints?.length ?? 0;
  const fromCount = observability.coachingHintCount ?? 0;
  return Math.max(fromList, fromCount);
}

function appliedHints(observability: ProjectMessageObservabilityMetadata): string[] {
  return (observability.coachingHints ?? []).filter((hint) => hint.trim().length > 0);
}

function vocabularyLines(observability?: ProjectMessageObservabilityMetadata): string[] {
  return formatVocabularyPanelLines(observability?.projectVocabulary);
}

function resolvedReferenceLines(observability?: ProjectMessageObservabilityMetadata): string[] {
  return formatResolvedReferencePanelLines(observability?.resolvedReferences);
}

function buildLabel(total: number, suffix?: string): string {
  const base = total === 1 ? '1 hint' : `${total} hints`;
  return suffix ? `${base} ${suffix}` : base;
}

/** Unified hints badge for assistant edit messages (guidance + coaching + vocabulary + resolved refs). */
export function getMessageHintsView(
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata
): CoachingSummaryView | null {
  const guidance = (guidanceHints ?? []).filter((hint) => hint.trim().length > 0);
  const coaching = observability ? appliedHints(observability) : [];
  const vocabulary = vocabularyLines(observability);
  const resolved = resolvedReferenceLines(observability);
  const contextExtras = vocabulary.length + resolved.length;

  const attachContext = (view: CoachingSummaryView): CoachingSummaryView => ({
    ...view,
    ...(vocabulary.length > 0 ? { projectVocabulary: vocabulary } : {}),
    ...(resolved.length > 0 ? { resolvedReferences: resolved } : {}),
  });

  if (
    observability &&
    !observability.coachingApplied &&
    observability.experimentVariant === 'control' &&
    guidance.length === 0
  ) {
    const count = Math.max(coaching.length, observability.coachingHintCount ?? 0);
    if (count > 0 || contextExtras > 0) {
      const total = count + contextExtras;
      const label =
        count > 0
          ? buildLabel(total, 'available (not applied)')
          : buildLabel(contextExtras);
      return attachContext({ label, hints: coaching });
    }
  }

  if (guidance.length === 0 && coaching.length === 0) {
    if (!observability) return null;

    if (contextExtras > 0) {
      return attachContext({
        label: buildLabel(contextExtras),
        hints: [],
      });
    }

    if (observability.coachingApplied) {
      const count = hintCount(observability);
      if (count <= 0) return { label: 'Hint applied', hints: [] };
      const label = count === 1 ? '1 hint applied' : `${count} hints applied`;
      return attachContext({ label, hints: coaching });
    }

    return null;
  }

  const primary = guidance.length > 0 ? guidance : coaching;
  const coachingExtra = coaching.filter((hint) => !guidance.includes(hint)).length;
  const total = guidance.length + coachingExtra + contextExtras;
  const label = buildLabel(total);

  return attachContext({
    label,
    hints: primary,
    monitorHints:
      guidance.length > 0 && coaching.length > 0
        ? coaching.filter((hint) => !guidance.includes(hint))
        : undefined,
  });
}

/** Human-readable coaching summary for assistant edit messages. */
export function formatCoachingSummary(
  observability?: ProjectMessageObservabilityMetadata,
  options?: { guidanceHints?: string[] }
): string | null {
  return getMessageHintsView(options?.guidanceHints, observability)?.label ?? null;
}

/** @deprecated Use getMessageHintsView — kept for callers passing observability only. */
export function getCoachingSummaryView(
  observability?: ProjectMessageObservabilityMetadata,
  options?: { outcome?: string; guidanceHints?: string[] }
): CoachingSummaryView | null {
  return getMessageHintsView(options?.guidanceHints, observability);
}

/** @deprecated Use getMessageHintsView — kept for clarify/failure guidance paths. */
export function getGuidanceTipsView(
  _outcome?: string,
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata
): CoachingSummaryView | null {
  return getMessageHintsView(guidanceHints, observability);
}

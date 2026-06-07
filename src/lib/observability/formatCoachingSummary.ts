import type { ProjectMessageObservabilityMetadata } from '@/lib/chat/projectMessageMetadata';

export interface CoachingSummaryView {
  label: string;
  hints: string[];
  /** Coaching hints when shown alongside local guidance in one panel. */
  monitorHints?: string[];
}

function hintCount(observability: ProjectMessageObservabilityMetadata): number {
  const fromList = observability.coachingHints?.length ?? 0;
  const fromCount = observability.coachingHintCount ?? 0;
  return Math.max(fromList, fromCount);
}

function appliedHints(observability: ProjectMessageObservabilityMetadata): string[] {
  return (observability.coachingHints ?? []).filter((hint) => hint.trim().length > 0);
}

/** Unified hints badge for assistant edit messages (guidance + coaching). */
export function getMessageHintsView(
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata
): CoachingSummaryView | null {
  const guidance = (guidanceHints ?? []).filter((hint) => hint.trim().length > 0);
  const coaching = observability ? appliedHints(observability) : [];

  if (
    observability &&
    !observability.coachingApplied &&
    observability.experimentVariant === 'control' &&
    guidance.length === 0
  ) {
    const count = Math.max(coaching.length, observability.coachingHintCount ?? 0);
    if (count > 0) {
      const label =
        count === 1 ? '1 hint available (not applied)' : `${count} hints available (not applied)`;
      return { label, hints: coaching };
    }
  }

  if (guidance.length === 0 && coaching.length === 0) {
    if (!observability) return null;

    if (observability.coachingApplied) {
      const count = hintCount(observability);
      if (count <= 0) return { label: 'Hint applied', hints: [] };
      const label = count === 1 ? '1 hint applied' : `${count} hints applied`;
      return { label, hints: coaching };
    }

    return null;
  }

  const primary = guidance.length > 0 ? guidance : coaching;
  const total = guidance.length + coaching.filter((hint) => !guidance.includes(hint)).length;
  const label = total === 1 ? '1 hint' : `${total} hints`;

  return {
    label,
    hints: primary,
    monitorHints:
      guidance.length > 0 && coaching.length > 0
        ? coaching.filter((hint) => !guidance.includes(hint))
        : undefined,
  };
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

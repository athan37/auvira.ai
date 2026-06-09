import type { ProjectMessageObservabilityMetadata } from '@/lib/chat/projectMessageMetadata';
import {
  formatProjectMemoryPanelLines,
  formatUsedProjectContextLines,
} from './formatEditContextSummary';

export interface CoachingSummaryView {
  label: string;
  hints: string[];
  /** Coaching hints when shown alongside local guidance in one panel. */
  monitorHints?: string[];
  /** @deprecated Vocabulary is no longer shown in chat tips. */
  projectVocabulary?: string[];
  /** @deprecated Use appliedProjectMemory via getProjectMemoryView. */
  resolvedReferences?: string[];
}

export interface ProjectMemoryView {
  lines: string[];
  panelLines: string[];
  label: string;
}

function hintCount(observability: ProjectMessageObservabilityMetadata): number {
  const fromList = observability.coachingHints?.length ?? 0;
  const fromCount = observability.coachingHintCount ?? 0;
  return Math.max(fromList, fromCount);
}

function appliedHints(observability: ProjectMessageObservabilityMetadata): string[] {
  return (observability.coachingHints ?? []).filter((hint) => hint.trim().length > 0);
}

function buildLabel(total: number, suffix?: string): string {
  const base = total === 1 ? '1 tip' : `${total} tips`;
  return suffix ? `${base} ${suffix}` : base;
}

function memoryReferences(
  observability?: ProjectMessageObservabilityMetadata
): ProjectMessageObservabilityMetadata['appliedProjectMemory'] {
  if (observability?.appliedProjectMemory?.length) {
    return observability.appliedProjectMemory;
  }
  return observability?.resolvedReferences;
}

/** Project Memory surface — success turns with applied resolved references only. */
export function getProjectMemoryView(
  outcome?: string,
  observability?: ProjectMessageObservabilityMetadata
): ProjectMemoryView | null {
  if (outcome !== 'success') return null;
  const refs = memoryReferences(observability);
  if (!refs?.length) return null;
  const count = refs.length;
  return {
    lines: formatUsedProjectContextLines(refs),
    panelLines: formatProjectMemoryPanelLines(refs),
    label: count > 1 ? `Context · ${count}` : 'Context',
  };
}

/** Tips surface — clarification/failure guidance and coaching only (never on success). */
export function getTipsView(
  outcome?: string,
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata
): CoachingSummaryView | null {
  if (outcome === 'success') return null;
  if (outcome !== 'clarification' && outcome !== 'failure') return null;

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
      return {
        label: buildLabel(count, 'available (not applied)'),
        hints: coaching,
      };
    }
  }

  if (guidance.length === 0 && coaching.length === 0) {
    return null;
  }

  const primary = guidance.length > 0 ? guidance : coaching;
  const coachingExtra = coaching.filter((hint) => !guidance.includes(hint)).length;
  const total = guidance.length + coachingExtra;
  const label = buildLabel(total);

  return {
    label,
    hints: primary,
    monitorHints:
      guidance.length > 0 && coaching.length > 0
        ? coaching.filter((hint) => !guidance.includes(hint))
        : undefined,
  };
}

/** @deprecated Use getProjectMemoryView + getTipsView — kept for migration tests. */
export function getMessageHintsView(
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata,
  outcome?: string
): CoachingSummaryView | null {
  return getTipsView(outcome, guidanceHints, observability);
}

/** Human-readable coaching summary for assistant edit messages. */
export function formatCoachingSummary(
  observability?: ProjectMessageObservabilityMetadata,
  options?: { guidanceHints?: string[]; outcome?: string }
): string | null {
  return getTipsView(options?.outcome, options?.guidanceHints, observability)?.label ?? null;
}

/** @deprecated Use getTipsView — kept for callers passing observability only. */
export function getCoachingSummaryView(
  observability?: ProjectMessageObservabilityMetadata,
  options?: { outcome?: string; guidanceHints?: string[] }
): CoachingSummaryView | null {
  return getTipsView(options?.outcome, options?.guidanceHints, observability);
}

/** @deprecated Use getTipsView — kept for clarify/failure guidance paths. */
export function getGuidanceTipsView(
  outcome?: string,
  guidanceHints?: string[],
  observability?: ProjectMessageObservabilityMetadata
): CoachingSummaryView | null {
  return getTipsView(outcome, guidanceHints, observability);
}

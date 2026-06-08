import type { ProjectChatOutcome } from '@/lib/chat/projectMessageMetadata';

export type ObservabilityBadgeTone = 'default' | 'success' | 'warning' | 'error' | 'info';

/** Map edit outcome to semantic Badge tone for observability UI. */
export function outcomeToBadgeTone(
  outcome: ProjectChatOutcome | string | undefined
): ObservabilityBadgeTone {
  switch (outcome) {
    case 'success':
      return 'success';
    case 'clarification':
      return 'warning';
    case 'failure':
      return 'error';
    default:
      return 'default';
  }
}

/** Map Site Monitor letter grade to semantic Badge tone. */
export function gradeToBadgeTone(grade: string | undefined): ObservabilityBadgeTone {
  if (!grade?.trim()) return 'default';

  const letter = grade.trim().charAt(0).toUpperCase();
  switch (letter) {
    case 'A':
      return 'success';
    case 'B':
      return 'info';
    case 'C':
      return 'warning';
    case 'D':
    case 'F':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Shared types for UI-pinned section target (preview selection → edit agent).
 */

export interface SelectedTargetInput {
  kind: 'section' | 'hero';
  sectionId?: string;
  analyticsId?: string;
  sectionIndex?: number;
  sectionType?: string;
  sectionTitle?: string;
}

/** Normalize client/API selectedTarget to a consistent shape. */
export function normalizeSelectedTarget(
  raw: unknown
): SelectedTargetInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const kind = input.kind === 'hero' || input.kind === 'section' ? input.kind : undefined;
  if (!kind) return undefined;

  const sectionId =
    typeof input.sectionId === 'string' && input.sectionId.trim()
      ? input.sectionId.trim()
      : typeof input.analyticsId === 'string' && input.analyticsId.trim()
        ? input.analyticsId.trim()
        : undefined;

  const sectionIndex =
    typeof input.sectionIndex === 'number' && Number.isFinite(input.sectionIndex)
      ? input.sectionIndex
      : undefined;

  const sectionType =
    typeof input.sectionType === 'string' && input.sectionType.trim()
      ? input.sectionType.trim()
      : kind === 'hero'
        ? 'hero'
        : undefined;

  const sectionTitle =
    typeof input.sectionTitle === 'string' && input.sectionTitle.trim()
      ? input.sectionTitle.trim()
      : undefined;

  if (kind === 'hero') {
    return {
      kind: 'hero',
      sectionId: sectionId ?? 'hero',
      analyticsId: sectionId ?? 'hero',
      sectionType: 'hero',
      sectionTitle: sectionTitle ?? 'Hero',
    };
  }

  if (!sectionId && sectionIndex == null) return undefined;

  return {
    kind: 'section',
    sectionId,
    analyticsId:
      typeof input.analyticsId === 'string' && input.analyticsId.trim()
        ? input.analyticsId.trim()
        : sectionId,
    sectionIndex,
    sectionType,
    sectionTitle,
  };
}

/** DOM/analytics id used to highlight a section in the preview iframe. */
export function selectedTargetSectionId(target: SelectedTargetInput): string | undefined {
  if (target.kind === 'hero') return target.sectionId ?? target.analyticsId ?? 'hero';
  return target.sectionId ?? target.analyticsId;
}

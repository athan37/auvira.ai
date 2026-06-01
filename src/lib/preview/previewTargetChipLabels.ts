import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

export type PreviewTargetChipVariant = 'pinned' | 'used';

/** Human-readable target name without variant prefix (e.g. "Hero", "CTA: Book Now"). */
export function formatPreviewTargetLabel(target: SelectedTargetInput): string {
  if (target.kind === 'hero') return 'Hero';

  const title = target.sectionTitle?.trim();
  const type = target.sectionType?.trim();

  if (title && type && title.toLowerCase() !== type.toLowerCase()) {
    return `${type}: ${title}`;
  }

  return title || type || 'Section';
}

/** Full chip label including variant prefix (e.g. "Pinned: CTA: Book Now"). */
export function formatPreviewTargetChipText(
  target: SelectedTargetInput,
  variant: PreviewTargetChipVariant
): string {
  const prefix = variant === 'pinned' ? 'Pinned' : 'Used';
  return `${prefix}: ${formatPreviewTargetLabel(target)}`;
}

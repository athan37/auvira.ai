import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';

export type PreviewTargetChipVariant = 'pinned' | 'used';

function fieldPathLabel(fieldPath: string): string | null {
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed) return null;
  if (parsed.scope === 'hero') return parsed.field;
  if (parsed.scope === 'section') return parsed.field;
  if (parsed.scope === 'sectionItem') {
    return `item ${(parsed.itemIndex ?? 0) + 1} ${parsed.field}`;
  }
  return parsed.field;
}

/** Human-readable target name without variant prefix (e.g. "Hero", "Services › title"). */
export function formatPreviewTargetLabel(target: SelectedTargetInput): string {
  if (target.kind === 'hero') {
    const fieldLabel = target.fieldPath ? fieldPathLabel(target.fieldPath) : null;
    return fieldLabel ? `Hero › ${fieldLabel}` : 'Hero';
  }

  const title = target.sectionTitle?.trim();
  const type = target.sectionType?.trim();
  const sectionLabel =
    title && type && title.toLowerCase() !== type.toLowerCase()
      ? `${type}: ${title}`
      : title || type || 'Section';

  if (target.elementLabel?.trim()) {
    return `${sectionLabel} › ${target.elementLabel.trim()}`;
  }

  if (target.fieldPath) {
    const fieldLabel = fieldPathLabel(target.fieldPath);
    if (fieldLabel) return `${sectionLabel} › ${fieldLabel}`;
  }

  if (target.elementKind) {
    return `${sectionLabel} › ${target.elementKind}`;
  }

  return sectionLabel;
}

/** Full chip label including variant prefix (e.g. "Pinned: Services › title"). */
export function formatPreviewTargetChipText(
  target: SelectedTargetInput,
  variant: PreviewTargetChipVariant
): string {
  const prefix = variant === 'pinned' ? 'Pinned' : 'Used';
  return `${prefix}: ${formatPreviewTargetLabel(target)}`;
}

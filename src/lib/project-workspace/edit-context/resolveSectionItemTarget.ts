import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';

export interface PinnedSectionItemTarget {
  sectionIndex: number;
  itemIndex?: number;
}

/** True when the section has a generic items[] list (not actionItems-only). */
export function sectionHasItemsList(siteConfigContent: string, sectionIndex: number): boolean {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const section = parsed?.sections?.[sectionIndex] as
    | { type?: string; items?: unknown[]; actionItems?: unknown[] }
    | undefined;
  if (!section) return false;
  if (String(section.type ?? '') === 'actions') return false;
  return Array.isArray(section.items);
}

function itemIndexFromFieldPath(fieldPath?: string): number | undefined {
  if (!fieldPath) return undefined;
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed || parsed.scope !== 'sectionItem') return undefined;
  return parsed.itemIndex;
}

/**
 * Resolve pinned section/item indices for generic sections[i].items[] edits.
 * Returns null for actionItem pins (defer to action pipeline).
 */
export function resolvePinnedSectionItemTarget(
  editContext: EditContext
): PinnedSectionItemTarget | null {
  const fieldPath =
    editContext.target.fieldPath ??
    editContext.selectedTarget?.fieldPath ??
    editContext.selectedTargetContext?.element?.fieldPath;

  if (fieldPath) {
    const parsed = parseConfigFieldPath(fieldPath);
    if (parsed?.scope === 'actionItem') return null;
  }

  const sectionIndex =
    editContext.target.sectionIndex ??
    editContext.selectedTarget?.sectionIndex ??
    editContext.selectedTargetContext?.resolved.sectionIndex;

  if (sectionIndex == null || sectionIndex < 0) return null;

  const itemIndex =
    editContext.selectedTarget?.itemIndex ??
    editContext.selectedTargetContext?.element?.itemIndex ??
    itemIndexFromFieldPath(fieldPath);

  return {
    sectionIndex,
    itemIndex: itemIndex != null && itemIndex >= 0 ? itemIndex : undefined,
  };
}

/** Parse item index from a sections[i].items[j] field path. */
export function parseSectionItemIndexFromFieldPath(fieldPath?: string): number | undefined {
  return itemIndexFromFieldPath(fieldPath);
}

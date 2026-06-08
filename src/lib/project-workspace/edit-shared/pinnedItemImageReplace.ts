import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  updateActionItemInSource,
  updateSectionItemInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import type { SelectedTargetInput } from './selectedTargetTypes';

export type PinnedCardKind = 'sectionItem' | 'actionItem';

export interface PinnedItemImageTarget {
  sectionIndex: number;
  itemIndex: number;
  kind: PinnedCardKind;
}

function itemIndexFromFieldPath(fieldPath?: string): number | undefined {
  if (!fieldPath) return undefined;
  const parsed = parseConfigFieldPath(fieldPath);
  if (parsed?.itemIndex != null) return parsed.itemIndex;

  const actionMatch = fieldPath.match(/\.actionItems\[(\d+)\]/);
  if (actionMatch) return Number(actionMatch[1]);

  const itemMatch = fieldPath.match(/\.items\[(\d+)\]/);
  if (itemMatch) return Number(itemMatch[1]);

  return undefined;
}

function sectionTypeAtIndex(
  siteConfigSource: string,
  sectionIndex: number
): string | undefined {
  const config = parseSiteConfigSource(siteConfigSource);
  const section = config?.sections?.[sectionIndex] as { type?: string } | undefined;
  return section?.type;
}

function resolvePinnedCardKind(
  siteConfigSource: string,
  sectionIndex: number,
  fieldPath?: string
): PinnedCardKind {
  const sectionType = String(sectionTypeAtIndex(siteConfigSource, sectionIndex) ?? '').toLowerCase();
  if (sectionType === 'actions') return 'actionItem';

  const parsed = fieldPath ? parseConfigFieldPath(fieldPath) : null;
  if (parsed?.scope === 'actionItem') return 'actionItem';
  if (parsed?.scope === 'sectionItem') return 'sectionItem';
  return 'sectionItem';
}

/** Resolve pinned section + item indices from preview drag metadata. */
export function resolvePinnedItemImageTarget(
  selectedTarget?: SelectedTargetInput | null,
  siteConfigSource?: string
): PinnedItemImageTarget | null {
  if (!selectedTarget) return null;

  const sectionIndex = selectedTarget.sectionIndex;
  if (sectionIndex == null || sectionIndex < 0) return null;

  let itemIndex = selectedTarget.itemIndex;
  if (itemIndex == null && selectedTarget.fieldPath) {
    itemIndex = itemIndexFromFieldPath(selectedTarget.fieldPath);
  }
  if (itemIndex == null && selectedTarget.targetChain?.length) {
    for (const node of [...selectedTarget.targetChain].reverse()) {
      if (node.itemIndex != null && node.itemIndex >= 0) {
        itemIndex = node.itemIndex;
        break;
      }
    }
  }

  if (itemIndex == null || itemIndex < 0) return null;

  const kind =
    siteConfigSource != null
      ? resolvePinnedCardKind(siteConfigSource, sectionIndex, selectedTarget.fieldPath)
      : selectedTarget.sectionType === 'actions' ||
          /\.actionItems\[\d+\]/.test(selectedTarget.fieldPath ?? '') ||
          parseConfigFieldPath(selectedTarget.fieldPath ?? '')?.scope === 'actionItem'
        ? 'actionItem'
        : 'sectionItem';

  return { sectionIndex, itemIndex, kind };
}

/** Patch imageUrl on a pinned section item or action card. */
export function applyPinnedItemImageReplaceToSource(
  siteConfigSource: string,
  sectionIndex: number,
  itemIndex: number,
  imageUrl: string,
  kind?: PinnedCardKind
): string | null {
  const resolvedKind =
    kind ?? resolvePinnedCardKind(siteConfigSource, sectionIndex);

  if (resolvedKind === 'actionItem') {
    return updateActionItemInSource(siteConfigSource, sectionIndex, itemIndex, { imageUrl });
  }

  return updateSectionItemInSource(siteConfigSource, sectionIndex, itemIndex, { imageUrl });
}

/** Confirm the uploaded URL landed on the pinned card, not another slot. */
export function validatePinnedItemImageReplace(
  siteConfigSource: string,
  sectionIndex: number,
  itemIndex: number,
  expectedUrl: string,
  kind?: PinnedCardKind
): { ok: boolean; reason: string } {
  const config = parseSiteConfigSource(siteConfigSource);
  if (!config) {
    return { ok: false, reason: 'siteConfig parse failed after pinned item image replace' };
  }

  const section = config.sections?.[sectionIndex] as
    | {
        title?: string;
        type?: string;
        items?: Array<{ imageUrl?: string }>;
        actionItems?: Array<{ imageUrl?: string; name?: string }>;
      }
    | undefined;
  if (!section) {
    return { ok: false, reason: `section index ${sectionIndex} not found` };
  }

  const resolvedKind =
    kind ?? resolvePinnedCardKind(siteConfigSource, sectionIndex);

  if (resolvedKind === 'actionItem') {
    const actionItem = section.actionItems?.[itemIndex];
    if (!actionItem) {
      return {
        ok: false,
        reason: `actionItems[${itemIndex}] not found in section ${sectionIndex}`,
      };
    }
    if (actionItem.imageUrl !== expectedUrl) {
      return {
        ok: false,
        reason: `expected actionItems[${itemIndex}].imageUrl=${expectedUrl} but got ${actionItem.imageUrl ?? '(unset)'}`,
      };
    }
    return {
      ok: true,
      reason: `Pinned action card ${itemIndex + 1} image updated in "${section.title ?? 'section'}"`,
    };
  }

  const item = section.items?.[itemIndex];
  if (!item) {
    return { ok: false, reason: `item index ${itemIndex} not found in section ${sectionIndex}` };
  }

  if (item.imageUrl !== expectedUrl) {
    return {
      ok: false,
      reason: `expected items[${itemIndex}].imageUrl=${expectedUrl} but got ${item.imageUrl ?? '(unset)'}`,
    };
  }

  return {
    ok: true,
    reason: `Pinned item ${itemIndex + 1} image updated in "${section.title ?? 'section'}"`,
  };
}

import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import {
  addSectionItemToSource,
  cloneSectionItemRecord,
  duplicateSectionItemInSource,
  removeSectionItemFromSource,
  updateSectionItemInSource,
  type SectionItemRecord,
} from '@/lib/project-workspace/siteConfigMutations';
import { parseSectionItemIndexFromFieldPath } from '@/lib/project-workspace/edit-context/resolveSectionItemTarget';
import type { DomainToolContext, DomainToolResult } from './types';

const ITEM_PATCH_FIELDS = ['title', 'description', 'imageUrl', 'alt', 'label', 'href'] as const;

function parseSectionItemIndex(ctx: DomainToolContext, params: Record<string, unknown>): number | undefined {
  if (typeof params.itemIndex === 'number' && params.itemIndex >= 0) {
    return params.itemIndex;
  }
  if (typeof params.cloneFromItemIndex === 'number' && params.cloneFromItemIndex >= 0) {
    return params.cloneFromItemIndex;
  }
  return parseSectionItemIndexFromFieldPath(
    ctx.editContext.target.fieldPath ??
      ctx.editContext.selectedTarget?.fieldPath ??
      ctx.editContext.selectedTargetContext?.element?.fieldPath
  );
}

function resolveSectionIndex(ctx: DomainToolContext, params: Record<string, unknown>): number | undefined {
  if (typeof params.sectionIndex === 'number' && params.sectionIndex >= 0) {
    return params.sectionIndex;
  }
  return (
    ctx.editContext.target.sectionIndex ??
    ctx.editContext.selectedTarget?.sectionIndex ??
    ctx.editContext.selectedTargetContext?.resolved.sectionIndex
  );
}

function readItemPatch(params: Record<string, unknown>): SectionItemRecord {
  const patch: SectionItemRecord = {};
  for (const field of ITEM_PATCH_FIELDS) {
    const value = params[field];
    if (typeof value === 'string' && value.trim()) {
      patch[field] = value.trim();
    }
  }
  if (typeof params.title === 'string' && params.title.trim()) {
    patch.title = params.title.trim();
  }
  if (typeof params.description === 'string' && params.description.trim()) {
    patch.description = params.description.trim();
  }
  return patch;
}

/** Mutate generic sections[i].items[] entries in siteConfig.ts. */
export async function updateSectionItemsTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const action = String(params.action ?? params.skill ?? 'add_section_item');
  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  const sectionIndex = resolveSectionIndex(ctx, params);
  if (sectionIndex == null || sectionIndex < 0) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['update_section_items requires sectionIndex'],
    };
  }

  if (action === 'add_section_item') {
    const itemIndex = parseSectionItemIndex(ctx, params);
    const patch = readItemPatch(params);
    const cloneFromItemIndex =
      typeof params.cloneFromItemIndex === 'number'
        ? params.cloneFromItemIndex
        : params.cloneFromPinned === true
          ? itemIndex
          : undefined;

    let updated: string | null = null;
    if (cloneFromItemIndex != null && cloneFromItemIndex >= 0) {
      updated = duplicateSectionItemInSource(content, sectionIndex, cloneFromItemIndex, patch);
    } else {
      updated = addSectionItemToSource(content, sectionIndex, patch, {
        insertAfterIndex:
          typeof params.insertAfterIndex === 'number' ? params.insertAfterIndex : undefined,
        fallbackTitle: patch.title ?? 'New item',
      });
    }

    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Section item could not be added'],
      };
    }

    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: patch.title
        ? `Added card "${patch.title}" to the section.`
        : 'Added a new card to the section.',
      evidence: {
        sectionIndex: String(sectionIndex),
        operation: 'add',
        title: patch.title ?? '',
      },
    };
  }

  if (action === 'duplicate_section_item') {
    const itemIndex = parseSectionItemIndex(ctx, params);
    if (itemIndex == null || itemIndex < 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['duplicate_section_item requires itemIndex'],
      };
    }
    const patch = readItemPatch(params);
    const updated = duplicateSectionItemInSource(content, sectionIndex, itemIndex, patch);
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Section item could not be duplicated'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: 'Duplicated the pinned card.',
      evidence: {
        sectionIndex: String(sectionIndex),
        itemIndex: String(itemIndex),
        operation: 'duplicate',
      },
    };
  }

  if (action === 'remove_section_item') {
    const itemIndex = parseSectionItemIndex(ctx, params);
    if (itemIndex == null || itemIndex < 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['remove_section_item requires itemIndex'],
      };
    }
    const updated = removeSectionItemFromSource(content, sectionIndex, itemIndex);
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Section item could not be removed'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: 'Removed the pinned card.',
      evidence: {
        sectionIndex: String(sectionIndex),
        itemIndex: String(itemIndex),
        operation: 'remove',
      },
    };
  }

  if (action === 'update_section_item') {
    const itemIndex = parseSectionItemIndex(ctx, params);
    if (itemIndex == null || itemIndex < 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['update_section_item requires itemIndex'],
      };
    }
    const patch = readItemPatch(params);
    if (params.field && params.value) {
      const field = String(params.field).trim();
      const value = String(params.value).trim();
      if ((ITEM_PATCH_FIELDS as readonly string[]).includes(field)) {
        patch[field as keyof SectionItemRecord] = value;
      }
    }
    if (Object.keys(patch).length === 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['update_section_item requires at least one field to update'],
      };
    }
    const updated = updateSectionItemInSource(content, sectionIndex, itemIndex, patch);
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Section item could not be updated'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: 'Updated the pinned card.',
      evidence: {
        sectionIndex: String(sectionIndex),
        itemIndex: String(itemIndex),
        operation: 'update',
        field: Object.keys(patch)[0] ?? '',
        expectedValue: Object.values(patch)[0] ?? '',
      },
    };
  }

  return {
    ok: false,
    changedFiles: [],
    summary: '',
    invariantErrors: [`Unsupported update_section_items action: ${action}`],
  };
}

export { cloneSectionItemRecord };

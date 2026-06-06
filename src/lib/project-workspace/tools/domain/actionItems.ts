import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import {
  addActionItemToSource,
  ensureActionsSectionInSource,
  removeActionItemFromSource,
  updateActionItemFieldInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import type { ActionModuleKind, ActionType } from '@/lib/builder/actionItemTypes';
import type { DomainToolContext, DomainToolResult } from './types';

const MODULE_TITLES: Record<ActionModuleKind, string> = {
  service_packages: 'Service Packages',
  menu_items: 'Menu Highlights',
  donation_tiers: 'Support Our Cause',
  event_rsvp: 'Reserve Your Spot',
  portfolio_ctas: 'Featured Projects',
};

/** Mutate action sections and items in siteConfig.ts. */
export async function updateActionItemsTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const action = String(params.action ?? 'add_action_item');
  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  if (action === 'add_actions_section') {
    const moduleKind = String(params.moduleKind ?? 'service_packages') as ActionModuleKind;
    const title = String(params.title ?? MODULE_TITLES[moduleKind] ?? 'Actions').trim();
    const subtitle = String(params.subtitle ?? params.body ?? '').trim() || undefined;
    const updated = ensureActionsSectionInSource(content, { moduleKind, title, subtitle });
    let next = updated ?? content;

    if (params.seedItem && typeof params.seedItem === 'object') {
      const seed = params.seedItem as Record<string, unknown>;
      const seeded = addActionItemToSource(next, {
        name: String(seed.name ?? 'New item'),
        description: String(seed.description ?? '').trim() || undefined,
        valueLabel: String(seed.valueLabel ?? '').trim() || undefined,
        actionType: String(seed.actionType ?? params.defaultActionType ?? 'quote') as ActionType,
        moduleKind,
        sectionTitle: title,
      });
      if (seeded) next = seeded;
    }

    if (next === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Actions section already exists or could not be added'],
      };
    }

    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, next);
    ctx.afterFiles[SITE_CONFIG] = next;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: `Added actions section "${title}".`,
      evidence: { moduleKind, title },
    };
  }

  if (action === 'add_action_item') {
    const name = String(params.name ?? params.title ?? 'New item').trim();
    const actionType = String(params.actionType ?? 'quote') as ActionType;
    const moduleKind = params.moduleKind
      ? (String(params.moduleKind) as ActionModuleKind)
      : undefined;
    const updated = addActionItemToSource(content, {
      name,
      description: String(params.description ?? '').trim() || undefined,
      valueLabel: String(params.valueLabel ?? '').trim() || undefined,
      actionType,
      moduleKind,
      ctaLabel: String(params.ctaLabel ?? '').trim() || undefined,
      sectionTitle: String(params.sectionTitle ?? '').trim() || undefined,
    });
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Action item already exists or could not be added'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: `Added action item "${name}".`,
      evidence: { name, actionType },
    };
  }

  if (action === 'update_action_item') {
    const sectionIndex =
      typeof params.sectionIndex === 'number'
        ? params.sectionIndex
        : ctx.editContext.target.sectionIndex;
    const itemIndex =
      typeof params.itemIndex === 'number'
        ? params.itemIndex
        : parseItemIndexFromFieldPath(ctx.editContext.target.fieldPath);
    if (sectionIndex == null || sectionIndex < 0 || itemIndex == null || itemIndex < 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['update_action_item requires sectionIndex and itemIndex'],
      };
    }

    const patch: Record<string, string> = {};
    for (const field of ['name', 'description', 'valueLabel', 'ctaLabel'] as const) {
      const value = String(params[field] ?? '').trim();
      if (value) patch[field] = value;
    }
    if (params.field && params.value) {
      patch[String(params.field)] = String(params.value).trim();
    }
    if (!Object.keys(patch).length) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['update_action_item requires at least one field to update'],
      };
    }

    let working = content;
    let changed = false;
    for (const [field, value] of Object.entries(patch)) {
      const next = updateActionItemFieldInSource(working, sectionIndex, itemIndex, field, value);
      if (next && next !== working) {
        working = next;
        changed = true;
      }
    }
    if (!changed) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Action item could not be updated'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, working);
    ctx.afterFiles[SITE_CONFIG] = working;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: 'Updated action item.',
      evidence: patch,
    };
  }

  if (action === 'remove_action_item') {
    const sectionIndex =
      typeof params.sectionIndex === 'number'
        ? params.sectionIndex
        : ctx.editContext.target.sectionIndex;
    const itemIndex =
      typeof params.itemIndex === 'number'
        ? params.itemIndex
        : parseItemIndexFromFieldPath(ctx.editContext.target.fieldPath);
    if (sectionIndex == null || sectionIndex < 0 || itemIndex == null || itemIndex < 0) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['remove_action_item requires sectionIndex and itemIndex'],
      };
    }
    const updated = removeActionItemFromSource(content, sectionIndex, itemIndex);
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Action item could not be removed'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: 'Removed action item.',
    };
  }

  return {
    ok: false,
    changedFiles: [],
    summary: '',
    invariantErrors: [`Unsupported update_action_items action: ${action}`],
  };
}

function parseItemIndexFromFieldPath(fieldPath?: string): number | undefined {
  if (!fieldPath) return undefined;
  const match = fieldPath.match(/actionItems\[(\d+)\]/);
  return match?.[1] != null ? Number(match[1]) : undefined;
}

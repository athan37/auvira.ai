import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  addSectionToSource,
  addServiceToSource,
  removeSectionFromSource,
  reorderSectionsInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import type { DomainToolContext, DomainToolResult } from './types';

/** Add a section or service item to siteConfig. */
export async function updateSectionListTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const action = String(params.action ?? 'add_service');
  if (action === 'remove_section') {
    return removeSectionTool(ctx, params);
  }
  if (action === 'reorder_sections') {
    return reorderSectionsTool(ctx, params);
  }

  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  if (action === 'add_service') {
    const title = String(params.title ?? '').trim();
    const description = String(params.description ?? '').trim() || undefined;
    if (!title) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['add_service requires title'],
      };
    }
    const updated = addServiceToSource(content, { title, description });
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['Service already exists or could not be added'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: `Added ${title} to services.`,
      evidence: { title },
    };
  }

  return {
    ok: false,
    changedFiles: [],
    summary: '',
    invariantErrors: [`Unsupported update_section_list action: ${action}`],
  };
}

/** Remove a section by index from siteConfig. */
export async function removeSectionTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const sectionIndex =
    typeof params.sectionIndex === 'number'
      ? params.sectionIndex
      : ctx.editContext.target.sectionIndex;
  if (sectionIndex == null || sectionIndex < 0) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['remove_section requires sectionIndex'],
    };
  }

  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  const updated = removeSectionFromSource(content, sectionIndex);
  if (!updated || updated === content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['Section could not be removed'],
    };
  }

  await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
  ctx.afterFiles[SITE_CONFIG] = updated;
  return {
    ok: true,
    changedFiles: [SITE_CONFIG],
    summary: `Removed section at index ${sectionIndex}.`,
    evidence: { sectionIndex: String(sectionIndex) },
  };
}

/** Reorder sections in siteConfig. */
export async function reorderSectionsTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  const rawOrder = params.order ?? params.sectionOrder ?? params.indices;
  let order: number[] | undefined;
  if (Array.isArray(rawOrder) && rawOrder.length > 0) {
    order = rawOrder.map((v) => Number(v));
  } else {
    const fromIndex = typeof params.fromIndex === 'number' ? params.fromIndex : undefined;
    const toIndex = typeof params.toIndex === 'number' ? params.toIndex : undefined;
    const sectionCount = Array.isArray(parseSiteConfigSource(content)?.sections)
      ? (parseSiteConfigSource(content)!.sections as unknown[]).length
      : 0;
    if (fromIndex != null && toIndex != null && sectionCount > 0) {
      const indices = Array.from({ length: sectionCount }, (_, i) => i);
      const [moved] = indices.splice(fromIndex, 1);
      if (moved !== undefined) {
        indices.splice(toIndex, 0, moved);
        order = indices;
      }
    }
  }

  if (!order?.length) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['reorder_sections requires order or fromIndex and toIndex'],
    };
  }

  const updated = reorderSectionsInSource(content, order);
  if (!updated || updated === content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['Sections could not be reordered'],
    };
  }

  await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
  ctx.afterFiles[SITE_CONFIG] = updated;
  return {
    ok: true,
    changedFiles: [SITE_CONFIG],
    summary: `Reordered sections.`,
    evidence: { order: order.join(',') },
  };
}

/** Add a new config-driven section. */
export async function addSectionTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const title = String(params.title ?? '').trim();
  const type = String(params.type ?? 'generic');
  const body = String(params.body ?? '').trim() || undefined;

  if (!title) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['add_section requires title'],
    };
  }

  const content = await readWorkspaceRel(ctx.agentOptions, SITE_CONFIG);
  if (!content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['siteConfig.ts missing'],
    };
  }

  const updated = addSectionToSource(content, { type, title, body });
  if (!updated || updated === content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['Section already exists or could not be added'],
    };
  }

  await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
  ctx.afterFiles[SITE_CONFIG] = updated;

  return {
    ok: true,
    changedFiles: [SITE_CONFIG],
    summary: `Added section "${title}".`,
    evidence: { title, type },
  };
}

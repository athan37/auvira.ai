import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/website-edit-agent/strategyContext';
import {
  addSectionToSource,
  addServiceToSource,
} from '@/lib/project-workspace/website-edit-agent-v2/siteConfigMutations';
import type { DomainToolContext, DomainToolResult } from './types';

/** Add a section or service item to siteConfig. */
export async function updateSectionListTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const action = String(params.action ?? 'add_service');
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

import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/website-edit-agent/strategyContext';
import {
  updateHeroFieldInSource,
} from '@/lib/project-workspace/siteConfigMutations';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Update hero or section copy fields in siteConfig.
 */
export async function updateCopyFieldTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const scope = String(params.scope ?? 'hero');
  const field = String(params.field ?? 'headline');
  const value = String(params.value ?? '').trim();

  if (!value) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['update_copy_field requires value'],
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

  if (scope === 'hero') {
    const updated = updateHeroFieldInSource(content, field, value);
    if (!updated || updated === content) {
      return {
        ok: false,
        changedFiles: [],
        summary: '',
        invariantErrors: ['No hero field change applied'],
      };
    }
    await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
    ctx.afterFiles[SITE_CONFIG] = updated;
    return {
      ok: true,
      changedFiles: [SITE_CONFIG],
      summary: `Updated hero ${field}.`,
      evidence: { field, value },
    };
  }

  return {
    ok: false,
    changedFiles: [],
    summary: '',
    invariantErrors: [`Section copy updates not yet implemented for field ${field}`],
  };
}

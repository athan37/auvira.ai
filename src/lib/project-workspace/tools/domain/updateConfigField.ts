import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import { updateConfigFieldInSource } from '@/lib/project-workspace/siteConfigMutations';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Update an allowlisted siteConfig field by canonical path (e.g. sections[2].title).
 */
export async function updateConfigFieldTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const fieldPath = String(params.fieldPath ?? '').trim();
  const value = String(params.value ?? '').trim();

  if (!fieldPath || !value) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['update_config_field requires fieldPath and value'],
    };
  }

  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: [`Field path not allowlisted: ${fieldPath}`],
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

  const updated = updateConfigFieldInSource(content, fieldPath, value);
  if (!updated || updated === content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: [`No change applied for ${fieldPath}`],
    };
  }

  await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
  ctx.afterFiles[SITE_CONFIG] = updated;
  return {
    ok: true,
    changedFiles: [SITE_CONFIG],
    summary: `Updated ${fieldPath}.`,
    evidence: { fieldPath, value },
  };
}

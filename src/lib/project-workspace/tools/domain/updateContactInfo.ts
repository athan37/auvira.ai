import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import { updateContactFieldInSource } from '@/lib/project-workspace/siteConfigMutations';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Update phone, email, or address in siteConfig contact block.
 */
export async function updateContactInfoTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const field = params.field as 'phone' | 'email' | 'address';
  const value = String(params.value ?? '').trim();

  if (!field || !value) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['update_contact_info requires field and value'],
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

  const updated = updateContactFieldInSource(content, field, value);
  if (!updated || updated === content) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['No contact field change applied'],
    };
  }

  await writeWorkspaceRel(ctx.agentOptions, SITE_CONFIG, updated);
  ctx.afterFiles[SITE_CONFIG] = updated;

  return {
    ok: true,
    changedFiles: [SITE_CONFIG],
    summary: `Updated contact ${field} to ${value}.`,
    evidence: { field, value },
  };
}

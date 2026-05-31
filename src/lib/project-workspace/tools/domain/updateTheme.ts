import { runStrategyById } from '@/lib/project-workspace/edit-shared/strategyRegistry';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Update site-wide or hero theme via existing preset_theme strategy.
 */
export async function updateThemeTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  void params;
  const beforeHashes = ctx.agentOptions.gateway
    ? await ctx.agentOptions.gateway.computeHashes()
    : await computeWorkspaceHashes(ctx.agentOptions.workspacePath);

  const result = await runStrategyById('preset_theme', ctx.agentOptions, beforeHashes);

  if (!result?.ok) {
    return {
      ok: false,
      changedFiles: result?.changedFiles ?? [],
      summary: result?.summary ?? '',
      invariantErrors: [result?.error ?? 'Theme update failed'],
    };
  }

  return {
    ok: true,
    changedFiles: result.changedFiles ?? [],
    summary: result.summary ?? result.ownerMessage ?? 'Updated theme.',
  };
}

/** Image replacement — delegates clarification until dedicated pipeline exists. */
export async function replaceImageTool(
  _ctx: DomainToolContext,
  _params: Record<string, unknown>
): Promise<DomainToolResult> {
  return {
    ok: false,
    changedFiles: [],
    summary: '',
    invariantErrors: ['replace_image is not implemented in V3 yet; use attachments + legacy path'],
  };
}

/** Internal helper — returns site model slice (no file changes). */
export async function getSiteModelTool(ctx: DomainToolContext): Promise<DomainToolResult> {
  const sectionCount = ctx.editContext.sections.length;
  return {
    ok: true,
    changedFiles: [],
    summary: `Site model: ${sectionCount} sections, archetype ${ctx.editContext.siteModel.archetype}`,
    evidence: {
      sectionCount: String(sectionCount),
      archetype: ctx.editContext.siteModel.archetype,
    },
  };
}

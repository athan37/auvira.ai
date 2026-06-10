import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { runStrategyById } from '@/lib/project-workspace/edit-shared/strategyRegistry';
import { extractBackgroundColorFromMessage } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import type { DomainToolContext, DomainToolResult } from './types';

/** Theme strategy message — uses resolved effectiveMessage so implicit refs (e.g. favorite color) apply. */
function buildThemeOwnerMessage(
  ctx: DomainToolContext,
  params: Record<string, unknown>,
  scope: string
): string {
  const base =
    ctx.editContext.effectiveMessage?.trim() || ctx.agentOptions.ownerMessage;

  const paramColor = typeof params.color === 'string' ? params.color.trim() : '';
  const paramBgClass =
    typeof params.backgroundClass === 'string' ? params.backgroundClass.trim() : '';

  let message = base;
  if (paramColor && !extractBackgroundColorFromMessage(message)) {
    message = `${message} ${paramColor}`;
  }
  if (paramBgClass && !extractSectionBackgroundClassFromMessage(message)) {
    message = `${message} ${paramBgClass}`;
  }

  return scope === 'hero' ? `hero background ${message}` : message;
}

/**
 * Update site-wide or hero theme via existing preset_theme strategy.
 */
export async function updateThemeTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const scope = typeof params.scope === 'string' ? params.scope.trim() : '';
  const ownerMessage = buildThemeOwnerMessage(ctx, params, scope);

  const beforeHashes = ctx.agentOptions.gateway
    ? await ctx.agentOptions.gateway.computeHashes()
    : await computeWorkspaceHashes(ctx.agentOptions.workspacePath);

  const result = await runStrategyById(
    'preset_theme',
    { ...ctx.agentOptions, ownerMessage },
    beforeHashes
  );

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

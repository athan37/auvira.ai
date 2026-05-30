import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import {
  applySectionBackgroundEdit,
  sectionBackgroundEditFromAgentOptions,
} from '@/lib/project-workspace/sectionPresentationEdit';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Apply section background via the unified presentation pipeline.
 */
export async function applySectionBackgroundTool(
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
      invariantErrors: ['apply_section_background requires sectionIndex'],
    };
  }

  const section = ctx.editContext.sections.find((s) => s.index === sectionIndex);
  const backgroundClass =
    (typeof params.backgroundClass === 'string' && params.backgroundClass.trim()) ||
    (typeof params.backgroundColor === 'string' && params.backgroundColor.trim()
      ? colorNameToBackgroundClass(params.backgroundColor, ctx.editContext.effectiveMessage)
      : extractSectionBackgroundClassFromMessage(ctx.editContext.effectiveMessage));

  if (!backgroundClass) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: ['Could not resolve background class from request'],
    };
  }

  const pipelineInput = sectionBackgroundEditFromAgentOptions(
    ctx.agentOptions,
    {
      sectionIndex,
      sectionType:
        (typeof params.sectionType === 'string' ? params.sectionType : section?.type) ?? 'generic',
      title: (typeof params.title === 'string' ? params.title : section?.title) ?? undefined,
      rendererComponent:
        (typeof params.rendererComponent === 'string'
          ? params.rendererComponent
          : section?.rendererComponent) ?? undefined,
    },
    ''
  );
  pipelineInput.backgroundClass = backgroundClass;
  pipelineInput.workspace.ownerMessage = ctx.editContext.effectiveMessage;

  const result = await applySectionBackgroundEdit(pipelineInput);

  if (result.ok && result.changedFiles.includes('src/lib/siteConfig.ts')) {
    const { readWorkspaceRel } = await import(
      '@/lib/project-workspace/website-edit-agent/strategyContext'
    );
    const fresh = await readWorkspaceRel(ctx.agentOptions, 'src/lib/siteConfig.ts');
    if (fresh) ctx.afterFiles['src/lib/siteConfig.ts'] = fresh;
  }

  return {
    ok: result.ok,
    changedFiles: result.changedFiles,
    summary: result.summary,
    invariantErrors: result.ok ? undefined : result.invariantErrors,
    evidence: {
      backgroundClass: result.backgroundClass,
      sectionIndex: String(result.sectionIndex),
      sectionTitle: result.sectionTitle,
    },
  };
}

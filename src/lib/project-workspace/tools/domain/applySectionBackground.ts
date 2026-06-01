import { extractSectionBackgroundClassFromMessage, resolveSectionBackgroundClassForEdit } from '@/lib/builder/sectionPresentation';
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

  const presentationField =
    params.presentationField === 'cardClass' || params.presentationField === 'backgroundClass'
      ? params.presentationField
      : 'backgroundClass';
  const ownerMessage = ctx.editContext.effectiveMessage ?? ctx.editContext.ownerMessage ?? '';

  const section = ctx.editContext.sections.find((s) => s.index === sectionIndex);
  const backgroundClass = resolveSectionBackgroundClassForEdit(ownerMessage, {
    backgroundClass:
      typeof params.backgroundClass === 'string' ? params.backgroundClass : undefined,
    backgroundColor:
      typeof params.backgroundColor === 'string' ? params.backgroundColor : undefined,
    color: typeof params.color === 'string' ? params.color : undefined,
  });

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
  pipelineInput.presentationField = presentationField;
  pipelineInput.workspace.ownerMessage = ownerMessage;

  const result = await applySectionBackgroundEdit(pipelineInput);

  if (result.ok && result.changedFiles.includes('src/lib/siteConfig.ts')) {
    const { readWorkspaceRel } = await import(
      '@/lib/project-workspace/edit-shared/strategyContext'
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
      presentationField,
      sectionIndex: String(result.sectionIndex),
      sectionTitle: result.sectionTitle,
    },
  };
}

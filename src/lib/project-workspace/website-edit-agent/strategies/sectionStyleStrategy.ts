import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { extractBackgroundColorFromMessage } from '../preset/presetUtils';
import { buildStrategyResult } from '../strategyContext';
import {
  applySectionBackgroundEdit,
  sectionBackgroundEditFromAgentOptions,
} from '../../sectionPresentationEdit';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: section-scoped background via unified presentation pipeline.
 */
export async function runSectionStyleStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const plan = options.editTargetPlan;
  if (
    options.mode !== 'gitlab' ||
    !plan ||
    plan.what !== 'style_background' ||
    plan.where.kind !== 'section' ||
    plan.where.sectionIndex == null
  ) {
    return null;
  }

  const effectiveMessage = resolveEffectiveEditMessage(
    options.ownerMessage,
    options.conversationHistory ?? []
  );
  const toColor = extractBackgroundColorFromMessage(effectiveMessage);
  if (!toColor) return null;

  const sectionIndex = plan.where.sectionIndex;
  const componentName = plan.where.rendererComponent;

  const pipelineInput = sectionBackgroundEditFromAgentOptions(
    options,
    {
      sectionIndex,
      sectionType: plan.where.sectionType ?? 'generic',
      title: plan.where.title,
      rendererComponent: componentName,
    },
    toColor
  );
  pipelineInput.workspace.ownerMessage = effectiveMessage;

  let pipelineResult = await applySectionBackgroundEdit(pipelineInput);

  if (!pipelineResult.ok) {
    pipelineResult = await applySectionBackgroundEdit(pipelineInput);
  }

  if (pipelineResult.ok) {
    return buildStrategyResult(
      options,
      beforeHashes,
      'section_style',
      'L0',
      pipelineResult.summary,
      { confidence: 'high' }
    );
  }

  return {
    ok: false,
    error: pipelineResult.invariantErrors.join('; ') || 'Section color edit failed invariants',
    summary: pipelineResult.summary,
    ownerMessage: pipelineResult.summary,
    strategy: 'section_style',
    tier: 'L0',
    confidence: 'high',
    changedFiles: pipelineResult.changedFiles,
  };
}

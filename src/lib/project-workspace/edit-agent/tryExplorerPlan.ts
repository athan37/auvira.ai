import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import {
  exploreSectionTargetDeterministic,
  type ExplorerApplyResult,
} from '@/lib/project-workspace/edit-context/exploreSectionTarget';
import {
  isExplorerEditEnabled,
  shouldRunDeterministicExplorer,
} from '@/lib/project-workspace/edit-context/explorerFlag';
import { extractReplacementValue } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { runExplorerAgent } from './explorerAgent';
import { runIntentClarifier } from './intentClarifier';
import {
  planFromExplorerApply,
  planFromExplorerClarify,
  planFromExplorerStyleApply,
} from './planFromExplorer';

function isStyleEditIntent(message: string): boolean {
  const what = classifyEditWhat(message);
  return what === 'style_background' || what === 'style_card' || what === 'style_text';
}

/**
 * Explorer pipeline: deterministic surfaces first, optional LLM when ambiguous.
 */
export async function tryExplorerPlan(editContext: EditContext): Promise<EditPlan | null> {
  if (!shouldRunDeterministicExplorer(editContext)) return null;

  const explored = exploreSectionTargetDeterministic(editContext);

  if (explored.kind === 'needs_llm' && isStyleEditIntent(editContext.effectiveMessage)) {
    return null;
  }
  if (explored.kind === 'apply') {
    if (explored.fieldPath.includes('presentation.')) {
      const field = explored.fieldPath.includes('cardClass')
        ? 'cardClass'
        : 'backgroundClass';
      return planFromExplorerStyleApply(editContext, explored.fieldPath, field);
    }
    return planFromExplorerApply(editContext, explored);
  }

  if (explored.kind === 'none') return null;

  if (!isExplorerEditEnabled()) {
    if (explored.kind === 'needs_llm' && explored.candidates.length > 0) {
      return planFromExplorerClarify(
        editContext,
        explored.candidates,
        editContext.target.title
      );
    }
    return null;
  }

  const proposal = await runExplorerAgent({
    editContext,
    candidates: explored.candidates,
    preExtractedValue: explored.value,
  });

  let candidates = explored.candidates;
  if (proposal?.candidates?.length) {
    const paths = new Set(proposal.candidates.map((c) => c.fieldPath));
    const filtered = explored.candidates.filter((s) => paths.has(s.fieldPath));
    if (filtered.length > 0) candidates = filtered;
  }

  if (proposal?.action === 'apply' && proposal.fieldPath && proposal.confidence >= 0.7) {
    const value =
      proposal.value ??
      explored.value ??
      extractReplacementValue(editContext.effectiveMessage);
    if (value) {
      const surface = candidates.find((c) => c.fieldPath === proposal.fieldPath) ?? {
        surfaceId: proposal.fieldPath,
        humanLabel: proposal.fieldPath,
        fieldPath: proposal.fieldPath,
        source: 'config' as const,
        editFamily: 'copy' as const,
        confidence: 'medium' as const,
      };
      const apply: ExplorerApplyResult = {
        kind: 'apply',
        fieldPath: proposal.fieldPath,
        value,
        surface,
        reason: proposal.rationale ?? 'Explorer agent apply',
      };
      if (proposal.fieldPath.includes('presentation.')) {
        const field = proposal.fieldPath.includes('cardClass')
          ? 'cardClass'
          : 'backgroundClass';
        return planFromExplorerStyleApply(editContext, proposal.fieldPath, field);
      }
      return planFromExplorerApply(editContext, apply);
    }
  }

  const clarifier = await runIntentClarifier({
    message: editContext.effectiveMessage,
    sectionTitle: editContext.target.title,
    candidates,
    explorerRationale: proposal?.rationale,
  });

  if (clarifier?.silentPick) {
    const value =
      explored.value ?? extractReplacementValue(editContext.effectiveMessage);
    if (value) {
      const surface = candidates.find((c) => c.fieldPath === clarifier.fieldPath);
      if (surface) {
        return planFromExplorerApply(editContext, {
          kind: 'apply',
          fieldPath: clarifier.fieldPath,
          value,
          surface,
          reason: `Intent clarifier silent pick (${clarifier.confidence})`,
        });
      }
    }
  }

  if (isStyleEditIntent(editContext.effectiveMessage)) {
    return null;
  }

  return planFromExplorerClarify(editContext, candidates, editContext.target.title);
}

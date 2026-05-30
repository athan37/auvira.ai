import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import type { EditPlan, EditStep } from '@/lib/project-workspace/planner/editPlan.schema';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/types';
import { hasLlmApiKey, llmDescribe } from '../llmTestGate';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
  type SyntheticSiteSpec,
} from './syntheticSiteWorkspace';

export { hasLlmApiKey, llmDescribe };
export const runLlmIntegrationTests = hasLlmApiKey();

/** Default multi-section site spec aligned with `createPresentationTestWorkspace()`. */
export const BASE_SITE_SPEC = defaultMultiSectionSiteSpec();

let cachedWorkspacePath: string | undefined;

async function resolveWorkspacePath(siteSpec?: SyntheticSiteSpec): Promise<string> {
  if (siteSpec) {
    return createSyntheticWorkspace({
      site: siteSpec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });
  }

  if (!cachedWorkspacePath) {
    cachedWorkspacePath = await createSyntheticWorkspace({
      site: BASE_SITE_SPEC,
      pageMode: 'wired',
      tailwind: 'canonical',
      workspaceId: 'llm-plan-harness',
    });
  }
  return cachedWorkspacePath;
}

/** Read section index from a V3 style step (params or target). */
export function styleStepSectionIndex(step: EditStep | undefined): number | undefined {
  if (!step) return undefined;
  const params = step.params ?? {};
  const target = step.target ?? {};
  const fromParams = params.sectionIndex;
  const fromTarget = target.sectionIndex;
  if (typeof fromParams === 'number') return fromParams;
  if (typeof fromTarget === 'number') return fromTarget;
  return undefined;
}

/** Extract background/color hint from a V3 style step. */
export function styleStepBackgroundHint(step: EditStep | undefined): string {
  if (!step) return '';
  const params = step.params ?? {};
  const presentation = params.presentation as { backgroundClass?: string } | undefined;
  return String(
    params.backgroundColor ?? params.backgroundClass ?? presentation?.backgroundClass ?? ''
  );
}

/**
 * Run the V3 planner against the configured LLM provider.
 */
export async function planWithLiveLlm(
  ownerMessage: string,
  siteSpec: SyntheticSiteSpec = BASE_SITE_SPEC,
  conversationHistory?: ConversationTurn[]
): Promise<EditPlan> {
  const ownsWorkspace = siteSpec !== BASE_SITE_SPEC;
  const workspacePath = await resolveWorkspacePath(ownsWorkspace ? siteSpec : undefined);

  try {
    const ctx = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage,
      conversationHistory,
      infraBaselineReady: true,
    });

    const result = await planEdit({
      editContext: ctx.context,
      userPrompt: ownerMessage,
    });

    if (!result.ok || !result.plan) {
      throw new Error(result.error ?? 'planEdit failed');
    }
    return result.plan;
  } finally {
    if (ownsWorkspace) {
      await destroySyntheticWorkspace(workspacePath);
    }
  }
}

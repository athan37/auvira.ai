import type { EditPlan, SiteModel } from '../../src/lib/project-workspace/website-edit-agent-v2';
import { planEdit } from '../../src/lib/project-workspace/website-edit-agent-v2';
import type { ConversationTurn } from '../../src/lib/project-workspace/website-edit-agent/types';
import { hasLlmApiKey, llmDescribe } from '../llmTestGate';
import {
  buildSyntheticSiteModel,
  defaultMultiSectionSiteSpec,
} from '../support/syntheticSiteWorkspace';

export { hasLlmApiKey, llmDescribe };
export const runLlmIntegrationTests = hasLlmApiKey();

/** Website-agnostic site model aligned with `createPresentationTestWorkspace()`. */
export const BASE_SITE_MODEL: SiteModel = buildSyntheticSiteModel(
  defaultMultiSectionSiteSpec()
);

/**
 * Run the real V2 planner against the configured LLM provider.
 */
export async function planWithLiveLlm(
  ownerMessage: string,
  siteModel: SiteModel = BASE_SITE_MODEL,
  conversationHistory?: ConversationTurn[]
): Promise<EditPlan> {
  return planEdit(
    {
      workspacePath: '/tmp/not-read',
      ownerMessage,
      projectId: 'llm-integration',
      mode: 'gitlab',
      conversationHistory,
    },
    { siteModel }
  );
}

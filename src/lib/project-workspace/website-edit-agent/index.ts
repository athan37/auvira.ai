import { isAllowedWorkspacePath } from '../workspaceEditShared';
import { routeEditRequest } from './intentRouter';
import { enrichEditPrompt } from './enrichEditPrompt';
import { runSingleShotStrategy } from './singleShotStrategy';
import { runSectionConfigStrategy } from './sectionConfigStrategy';
import { runAgentLoop } from './WebsiteEditAgent';
import type {
  AgentStepEvent,
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
} from './types';
import { computeWorkspaceHashes } from '../workspaceEditShared';

export { routeEditRequest, isTrivialStyleEdit } from './intentRouter';
export { verifyEditApplied, summarizeActualChanges } from './verifyEditApplied';
export type { WebsiteEditAgentOptions, WebsiteEditAgentResult, AgentStepEvent };

/**
 * Main entry: route request → single-shot or agent loop.
 */
export async function runWebsiteEditAgent(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  if (!options.gateway && !isAllowedWorkspacePath(options.workspacePath)) {
    return { ok: false, error: 'Workspace path is not in an allowed directory.' };
  }

  const decision = routeEditRequest(options.ownerMessage);
  const beforeHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const hasAttachments = (options.attachments?.length ?? 0) > 0;

  if (!options.gateway && !hasAttachments && decision.strategy === 'single_shot') {
    const fast = await runSingleShotStrategy(options, beforeHashes);
    if (fast?.ok) {
      return fast;
    }
  }

  if (!options.gateway && !hasAttachments && decision.intent === 'section' && options.mode === 'gitlab') {
    const sectionFast = await runSectionConfigStrategy(options, beforeHashes);
    if (sectionFast?.ok) {
      return sectionFast;
    }
  }

  const enriched = options.gateway
    ? {
        agentPrompt: options.ownerMessage,
        originalMessage: options.ownerMessage,
        contextFiles: [] as string[],
      }
    : await enrichEditPrompt(
        options.workspacePath,
        options.mode,
        options.ownerMessage,
        decision.intent,
        options.attachments || []
      );

  return runAgentLoop(
    {
      ...options,
      agentPrompt: enriched.agentPrompt,
    },
    onStep
  );
}

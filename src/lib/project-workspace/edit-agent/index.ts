import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { clarificationAnchorFromTarget } from '@/lib/project-workspace/edit-context/clarificationAnchor';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { routeAttachmentEdits } from '@/lib/project-workspace/edit-shared/attachmentRouter';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import type { AgentStepEvent, WebsiteEditAgentOptions, WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import { executePlan } from './executePlan';

function emitStep(
  onStep: ((event: AgentStepEvent) => void) | undefined,
  id: string,
  label: string,
  status: AgentStepEvent['status']
) {
  onStep?.({ type: 'step', id, label, status });
}

/**
 * Website Edit Agent: EditContext → plan → domain tools → verify → summarize.
 */
export async function runWebsiteEditAgent(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  emitStep(onStep, 'v3_context', 'Understanding your site', 'active');

  let beforeHashes: Record<string, string>;
  try {
    beforeHashes = options.gateway
      ? await options.gateway.computeHashes()
      : await computeWorkspaceHashes(options.workspacePath);
  } catch {
    beforeHashes = {};
  }

  const attachmentResult = await routeAttachmentEdits(options, beforeHashes);
  if (attachmentResult) {
    emitStep(onStep, 'v3_context', 'Understanding your site', 'completed');
    return attachmentResult;
  }

  const contextResult = await buildEditContext({
    workspacePath: options.workspacePath,
    mode: options.mode,
    ownerMessage: options.ownerMessage,
    conversationHistory: options.conversationHistory,
    gateway: options.gateway,
    infraBaselineReady: options.infraBaselineReady,
    editFocusStack: options.editFocusStack,
    selectedTarget: options.selectedTarget,
  });

  emitStep(onStep, 'v3_context', 'Understanding your site', 'completed');

  if (contextResult.needsClarification && contextResult.clarificationMessage) {
    return {
      ok: false,
      needsClarification: true,
      error: contextResult.clarificationMessage,
      ownerMessage: contextResult.clarificationMessage,
      suggestedReplies: contextResult.suggestedReplies,
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      clarificationAnchor: clarificationAnchorFromTarget(contextResult.context.target),
    };
  }

  emitStep(onStep, 'v3_plan', 'Planning the edit', 'active');

  const planResult = await planEdit({
    editContext: contextResult.context,
    userPrompt: options.ownerMessage,
    hasAttachments: (options.attachments?.length ?? 0) > 0,
    coachingContext: options.coachingContext,
  });

  if (!planResult.ok || !planResult.plan) {
    emitStep(onStep, 'v3_plan', 'Planning the edit', 'failed');
    return {
      ok: false,
      error: planResult.error ?? 'Planner failed',
      ownerMessage: 'I could not create a safe edit plan. Please try a more specific request.',
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
    };
  }

  emitStep(onStep, 'v3_plan', 'Planning the edit', 'completed');
  emitStep(onStep, 'v3_execute', 'Applying the edit', 'active');

  const result = await executePlan(
    planResult.plan,
    contextResult.context,
    options,
    beforeHashes
  );

  emitStep(
    onStep,
    'v3_execute',
    'Applying the edit',
    result.ok ? 'completed' : 'failed'
  );

  return result;
}

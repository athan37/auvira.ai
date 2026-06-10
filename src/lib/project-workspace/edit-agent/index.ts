import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { clarificationAnchorFromTarget } from '@/lib/project-workspace/edit-context/clarificationAnchor';
import {
  assessEditAmbiguity,
  defaultGuidanceHints,
} from '@/lib/project-workspace/edit-context/assessEditAmbiguity';
import {
  resolveImplicitReferences,
} from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { collectImplicitPhrases } from '@/lib/project-workspace/edit-context/extractImplicitReferences';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { routeAttachmentEdits } from '@/lib/project-workspace/edit-shared/attachmentRouter';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import { AgentPhaseTimer } from '@/lib/observability/agentPhaseTimer';
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

async function pendingImplicitRefFromMessage(
  ownerMessage: string
): Promise<WebsiteEditAgentResult['pendingImplicitRef']> {
  const { refs } = await collectImplicitPhrases(ownerMessage);
  const colorRef = refs.find((ref) => ref.kind === 'color');
  if (!colorRef) return undefined;
  return { phrase: colorRef.phrase, kind: colorRef.kind };
}

/**
 * Website Edit Agent: EditContext → plan → domain tools → verify → summarize.
 */
export async function runWebsiteEditAgent(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  const phaseTimer = new AgentPhaseTimer();

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

  phaseTimer.start('agent_context');
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
  phaseTimer.finish('agent_context');

  emitStep(onStep, 'v3_context', 'Understanding your site', 'completed');

  const editContext = contextResult.context;

  const implicitResolution = await resolveImplicitReferences({
    ownerMessage: options.ownerMessage,
    editContext,
    coachingContext: options.coachingContext,
    projectIntent: options.projectIntent,
    recentHistory: options.conversationHistory,
  });

  if (implicitResolution.needsClarification && implicitResolution.clarificationMessage) {
    const pendingImplicitRef = await pendingImplicitRefFromMessage(options.ownerMessage);
    return {
      ok: false,
      needsClarification: true,
      error: implicitResolution.clarificationMessage,
      ownerMessage: implicitResolution.clarificationMessage,
      suggestedReplies: implicitResolution.suggestedReplies,
      guidanceHints: defaultGuidanceHints(),
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      clarificationAnchor: clarificationAnchorFromTarget(editContext.target),
      resolvedReferences: implicitResolution.references,
      pendingImplicitRef,
      agentLatencyBreakdown: phaseTimer.toLatencyBreakdown(),
    };
  }

  if (implicitResolution.resolvedMessage) {
    editContext.effectiveMessage = implicitResolution.resolvedMessage;
  }
  if (implicitResolution.references.length > 0) {
    editContext.resolvedReferences = implicitResolution.references;
  }

  const structuralAssessment = assessEditAmbiguity(editContext);
  if (structuralAssessment.blocked && structuralAssessment.clarificationMessage) {
    return {
      ok: false,
      needsClarification: true,
      error: structuralAssessment.clarificationMessage,
      ownerMessage: structuralAssessment.clarificationMessage,
      suggestedReplies: structuralAssessment.suggestedReplies,
      guidanceHints: structuralAssessment.guidanceHints,
      ambiguityReasons: structuralAssessment.reasons,
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      clarificationAnchor: clarificationAnchorFromTarget(editContext.target),
      resolvedReferences: implicitResolution.references,
      agentLatencyBreakdown: phaseTimer.toLatencyBreakdown(),
    };
  }

  if (
    contextResult.needsClarification &&
    contextResult.clarificationMessage &&
    !implicitResolution.resolvedMessage
  ) {
    return {
      ok: false,
      needsClarification: true,
      error: contextResult.clarificationMessage,
      ownerMessage: contextResult.clarificationMessage,
      suggestedReplies: contextResult.suggestedReplies,
      guidanceHints: contextResult.guidanceHints ?? defaultGuidanceHints(),
      ambiguityReasons: contextResult.ambiguityReasons,
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      clarificationAnchor: clarificationAnchorFromTarget(editContext.target),
      resolvedReferences: implicitResolution.references,
      agentLatencyBreakdown: phaseTimer.toLatencyBreakdown(),
    };
  }

  emitStep(onStep, 'v3_plan', 'Planning the edit', 'active');

  phaseTimer.start('agent_plan');
  const planResult = await planEdit({
    editContext,
    userPrompt: options.ownerMessage,
    hasAttachments: (options.attachments?.length ?? 0) > 0,
    coachingContext: options.coachingContext,
    projectIntent: options.projectIntent,
  });
  phaseTimer.finish('agent_plan');

  if (!planResult.ok || !planResult.plan) {
    emitStep(onStep, 'v3_plan', 'Planning the edit', 'failed');
    return {
      ok: false,
      error: planResult.error ?? 'Planner failed',
      ownerMessage: 'I could not create a safe edit plan. Please try a more specific request.',
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      plannerPath: planResult.plannerPath,
      agentLatencyBreakdown: phaseTimer.toLatencyBreakdown(),
    };
  }

  emitStep(onStep, 'v3_plan', 'Planning the edit', 'completed');
  emitStep(onStep, 'v3_execute', 'Applying the edit', 'active');

  phaseTimer.start('agent_execute');
  const result = await executePlan(
    planResult.plan,
    editContext,
    options,
    beforeHashes
  );
  phaseTimer.finish('agent_execute');

  emitStep(
    onStep,
    'v3_execute',
    'Applying the edit',
    result.ok ? 'completed' : 'failed'
  );

  return {
    ...result,
    plannerPath: planResult.plannerPath,
    resolvedReferences: editContext.resolvedReferences ?? implicitResolution.references,
    agentLatencyBreakdown: phaseTimer.toLatencyBreakdown(),
  };
}

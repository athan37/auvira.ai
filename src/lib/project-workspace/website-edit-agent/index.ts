import { isAllowedWorkspacePath } from '../workspaceEditShared';
import { detectAmbiguousEditRequest } from './editAmbiguity';
import { classifyEditJob } from './editJobClassifier';
import { buildGroundedEditContext } from './buildGroundedEditContext';
import { enrichEditPrompt } from './enrichEditPrompt';
import { routeAttachmentEdits } from './attachmentRouter';
import { runAgentLoop } from './WebsiteEditAgent';
import { resolveSiteWorkspace } from './resolveSiteWorkspace';
import { runStrategyPlan } from './strategyRegistry';
import { routeEditRequest } from './intentRouter';
import type {
  AgentStepEvent,
  EditJobPlan,
  EditTargetPlan,
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
} from './types';
import { computeWorkspaceHashes } from '../workspaceEditShared';
import { verifyEditApplied } from './verifyEditApplied';
import {
  GLOBALS_CSS,
  PAGE_TSX,
  readWorkspaceRel,
} from './strategyContext';

const STYLE_VERIFY_PATHS = [PAGE_TSX, GLOBALS_CSS] as const;

async function snapshotStyleTargets(
  options: WebsiteEditAgentOptions
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const rel of STYLE_VERIFY_PATHS) {
    const content = await readWorkspaceRel(options, rel);
    if (content !== null) {
      files[rel] = content;
    }
  }
  return files;
}

async function captureChangedFileContents(
  options: WebsiteEditAgentOptions,
  changedFiles: string[]
): Promise<Record<string, string>> {
  const captured: Record<string, string> = {};
  for (const rel of changedFiles) {
    const content = await readWorkspaceRel(options, rel);
    if (content !== null) {
      captured[rel] = content;
    }
  }
  return captured;
}

function clarificationForUnresolvedStyle(
  editTargetPlan: EditTargetPlan | null | undefined,
  plan: EditJobPlan
): WebsiteEditAgentResult | null {
  const what = editTargetPlan?.what;
  if (!what || !['style_background', 'style_text', 'style_card'].includes(what)) {
    return null;
  }
  const where = editTargetPlan.where;
  if (where.kind !== 'section' || where.sectionIndex != null) {
    return null;
  }
  const ownerMessage =
    where.clarificationMessage ??
    'Which section should I update? Reply with the section title in quotes, or say "first section".';
  return {
    ok: false,
    needsClarification: true,
    error: ownerMessage,
    ownerMessage,
    suggestedReplies: where.suggestedReplies,
    strategy: plan.primaryStrategy,
    tier: plan.tier,
    confidence: 'low',
  };
}

function attachPlanMeta(
  result: WebsiteEditAgentResult,
  plan: ReturnType<typeof classifyEditJob>
): WebsiteEditAgentResult {
  return {
    ...result,
    tier: result.tier ?? plan.tier,
    confidence: result.confidence ?? plan.confidence,
    verifyProfile: result.verifyProfile ?? plan.verifyProfile,
  };
}

export { routeEditRequest, isTrivialStyleEdit, hasImageAttachments } from './intentRouter';
export { classifyEditJob } from './editJobClassifier';
export { verifyEditApplied, summarizeActualChanges } from './verifyEditApplied';
export { resolveSiteWorkspace, detectPageArchetype } from './resolveSiteWorkspace';
export {
  buildGroundedEditContext,
  classifyEditWhat,
  formatEditTargetPlanForPrompt,
} from './buildGroundedEditContext';
export {
  buildEnrichedSiteStructure,
  resolveSectionTarget,
  formatStructureMap,
} from './resolveSectionTarget';
export {
  buildSiteSectionCatalog,
  formatSectionCatalogForPrompt,
  matchSectionFromMessage,
  buildSectionSuggestedReplies,
} from './siteSectionCatalog';
export type { SiteSectionCatalog } from './siteSectionCatalog';
export type { SiteWorkspaceSnapshot, PageArchetype } from './resolveSiteWorkspace';
export type {
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
  AgentStepEvent,
  EditJobPlan,
  EditStrategyId,
  EditTier,
  EditTargetPlan,
  CodeContextBlock,
  SectionTargetResult,
} from './types';

/**
 * Main entry: classify → strategy registry → agent loop fallback.
 */
export async function runWebsiteEditAgent(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  if (!options.gateway && !isAllowedWorkspacePath(options.workspacePath)) {
    return { ok: false, error: 'Workspace path is not in an allowed directory.' };
  }

  const beforeHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const hasAttachments = (options.attachments?.length ?? 0) > 0;

  let workspaceSnap = null;
  try {
    if (options.gateway) {
      workspaceSnap = await resolveSiteWorkspace({
        workspacePath: options.workspacePath,
        mode: options.mode,
        gateway: options.gateway,
      });
    } else if (options.mode === 'static') {
      workspaceSnap = await resolveSiteWorkspace({
        workspacePath: options.workspacePath,
        mode: 'static',
      });
    } else {
      workspaceSnap = await resolveSiteWorkspace({
        workspacePath: options.workspacePath,
        mode: options.mode,
      });
    }
  } catch {
    workspaceSnap = null;
  }

  const grounded = await buildGroundedEditContext(
    workspaceSnap,
    options.ownerMessage,
    options.conversationHistory ?? [],
    options.workspacePath
  );

  if (
    grounded.needsClarification &&
    grounded.clarificationMessage &&
    !hasAttachments
  ) {
    return {
      ok: false,
      needsClarification: true,
      error: grounded.clarificationMessage,
      ownerMessage: grounded.clarificationMessage,
      suggestedReplies: grounded.suggestedReplies,
      tier: 'L3',
      confidence: 'low',
    };
  }

  const editTargetPlan = grounded.plan;
  const sectionCatalog = grounded.sectionCatalog ?? editTargetPlan?.sectionCatalog;
  const agentOptions: WebsiteEditAgentOptions = {
    ...options,
    editTargetPlan,
    sectionCatalog,
  };

  const plan = classifyEditJob(
    options.ownerMessage,
    options.attachments ?? [],
    workspaceSnap,
    options.conversationHistory ?? [],
    editTargetPlan
  );

  if (plan.needsClarification && plan.clarificationMessage) {
    return {
      ok: false,
      needsClarification: true,
      error: plan.clarificationMessage,
      ownerMessage: plan.clarificationMessage,
      suggestedReplies: plan.suggestedReplies,
      strategy: plan.primaryStrategy,
      tier: plan.tier,
      confidence: plan.confidence,
    };
  }

  if (hasAttachments) {
    const attachmentResult = await routeAttachmentEdits(agentOptions, beforeHashes);
    if (attachmentResult?.ok) {
      return attachPlanMeta(attachmentResult, plan);
    }
    if (attachmentResult && !attachmentResult.ok) {
      return attachmentResult;
    }
  }

  const { result, attempted, fallbackFrom } = await runStrategyPlan(plan, agentOptions, beforeHashes);

  if (result?.ok) {
    const beforeFiles = await snapshotStyleTargets(agentOptions);
    if (result.changedFiles?.length) {
      const capturedAfter = await captureChangedFileContents(agentOptions, result.changedFiles);
      const verification = verifyEditApplied(options.ownerMessage, beforeFiles, {
        ...beforeFiles,
        ...capturedAfter,
      });
      if (!verification.ok && plan.verifyProfile !== 'generic') {
        // Preview stream will verify; accept L0/L1 file writes
      }
    }
    return attachPlanMeta(
      {
        ...result,
        ...(fallbackFrom ? { summary: result.summary } : {}),
      },
      plan
    );
  }

  const unresolvedStyle = clarificationForUnresolvedStyle(editTargetPlan, plan);
  if (unresolvedStyle) {
    return unresolvedStyle;
  }

  const ambiguity = detectAmbiguousEditRequest(
    options.ownerMessage,
    options.conversationHistory ?? [],
    editTargetPlan ?? undefined,
    sectionCatalog
  );
  if (ambiguity.ambiguous && ambiguity.clarificationMessage) {
    return {
      ok: false,
      needsClarification: true,
      error: ambiguity.clarificationMessage,
      ownerMessage: ambiguity.clarificationMessage,
      suggestedReplies: ambiguity.suggestedReplies,
      strategy: plan.primaryStrategy,
      tier: plan.tier,
      confidence: ambiguity.confidence,
    };
  }

  const legacy = routeEditRequest(options.ownerMessage);
  const shouldRunAgentLoop =
    plan.primaryStrategy === 'agent_loop' || legacy.strategy === 'agent_loop';

  if (shouldRunAgentLoop) {
    const enriched = await enrichEditPrompt(
      options.workspacePath,
      options.mode,
      options.ownerMessage,
      legacy.intent,
      options.attachments || [],
      options.gateway,
      options.conversationHistory,
      editTargetPlan
    );

    const loopResult = await runAgentLoop(
      {
        ...agentOptions,
        agentPrompt: enriched.agentPrompt,
      },
      onStep
    );

    return {
      ...loopResult,
      strategy: 'agent_loop',
      tier: plan.tier === 'L3' ? 'L3' : loopResult.tier,
      confidence: plan.confidence,
      verifyProfile: plan.verifyProfile,
    };
  }

  void attempted;

  return {
    ok: false,
    needsClarification: true,
    error: 'Could not apply edit with a quick path.',
    ownerMessage:
      'I could not apply that change automatically. Try one specific edit (for example: "change the background of the section titled \\"Your Section\\" to red", or "change the first section background to red").',
    strategy: plan.primaryStrategy,
    tier: plan.tier,
    confidence: plan.confidence,
  };
}

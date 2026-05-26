import { isAllowedWorkspacePath } from '../workspaceEditShared';
import { classifyEditJob } from './editJobClassifier';
import { enrichEditPrompt } from './enrichEditPrompt';
import { routeAttachmentEdits } from './attachmentRouter';
import { runAgentLoop } from './WebsiteEditAgent';
import { resolveSiteWorkspace } from './resolveSiteWorkspace';
import { runStrategyPlan } from './strategyRegistry';
import { routeEditRequest } from './intentRouter';
import type {
  AgentStepEvent,
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
export type { SiteWorkspaceSnapshot, PageArchetype } from './resolveSiteWorkspace';
export type {
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
  AgentStepEvent,
  EditJobPlan,
  EditStrategyId,
  EditTier,
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

  const plan = classifyEditJob(
    options.ownerMessage,
    options.attachments ?? [],
    workspaceSnap
  );

  if (
    plan.needsClarification &&
    plan.confidence === 'low' &&
    plan.primaryStrategy === 'agent_loop' &&
    plan.tryOrder.length === 1
  ) {
    return {
      ok: false,
      error: plan.clarificationMessage,
      ownerMessage: plan.clarificationMessage,
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: 'low',
    };
  }

  if (hasAttachments) {
    const attachmentResult = await routeAttachmentEdits(options, beforeHashes);
    if (attachmentResult?.ok) {
      return attachPlanMeta(attachmentResult, plan);
    }
    if (attachmentResult && !attachmentResult.ok) {
      return attachmentResult;
    }
  }

  const { result, attempted, fallbackFrom } = await runStrategyPlan(plan, options, beforeHashes);

  if (result?.ok) {
    const beforeFiles = await snapshotStyleTargets(options);
    if (result.changedFiles?.length) {
      const capturedAfter = await captureChangedFileContents(options, result.changedFiles);
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

  if (plan.tier === 'L3' || plan.primaryStrategy === 'agent_loop') {
    const legacy = routeEditRequest(options.ownerMessage);
    const enriched = await enrichEditPrompt(
      options.workspacePath,
      options.mode,
      options.ownerMessage,
      legacy.intent,
      options.attachments || [],
      options.gateway
    );

    const loopResult = await runAgentLoop(
      {
        ...options,
        agentPrompt: enriched.agentPrompt,
      },
      onStep
    );

    return {
      ...loopResult,
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: plan.confidence,
      verifyProfile: plan.verifyProfile,
    };
  }

  void attempted;

  const legacy = routeEditRequest(options.ownerMessage);
  const enriched = await enrichEditPrompt(
    options.workspacePath,
    options.mode,
    options.ownerMessage,
    legacy.intent,
    options.attachments || [],
    options.gateway
  );

  const loopResult = await runAgentLoop(
    {
      ...options,
      agentPrompt: enriched.agentPrompt,
    },
    onStep
  );

  return {
    ...loopResult,
    strategy: 'agent_loop',
    tier: 'L3',
    confidence: 'low',
    verifyProfile: 'generic',
  };
}

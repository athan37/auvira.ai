import {
  PAGE_TSX,
  SITE_CONFIG,
  GLOBALS_CSS,
  readWorkspaceRel,
} from '@/lib/project-workspace/website-edit-agent/strategyContext';
import { computeWorkspaceHashes, getChangedFilesFromHashes } from '@/lib/project-workspace/workspaceEditShared';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '@/lib/project-workspace/website-edit-agent/types';
import {
  executeDomainTool,
} from '@/lib/project-workspace/tools/domain/registry';
import type { DomainToolContext } from '@/lib/project-workspace/tools/domain/types';
import { executeStep } from './executeStep';
import { captureEditRunSnapshot, rollbackChangedFiles } from './rollback';

async function captureBeforeFiles(options: WebsiteEditAgentOptions): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const rel of [SITE_CONFIG, PAGE_TSX, GLOBALS_CSS]) {
    const content = await readWorkspaceRel(options, rel);
    if (content !== null) files[rel] = content;
  }
  return files;
}

/**
 * Execute a V3 edit plan sequentially via domain tools.
 */
export async function executePlan(
  plan: EditPlan,
  editContext: EditContext,
  options: WebsiteEditAgentOptions,
  beforeHashes?: Record<string, string>
): Promise<WebsiteEditAgentResult> {
  if (plan.needsClarification) {
    const ownerMessage =
      plan.clarificationQuestion ?? 'What should I change? Please provide more detail.';
    return {
      ok: false,
      needsClarification: true,
      ownerMessage,
      error: ownerMessage,
      suggestedReplies: plan.suggestedReplies,
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      verifyProfile: 'generic',
    };
  }

  if (plan.steps.length === 0) {
    return {
      ok: false,
      error: 'Empty edit plan',
      ownerMessage: 'I could not determine what to change. Please be more specific.',
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
    };
  }

  const initialHashes =
    beforeHashes ??
    (options.gateway
      ? await options.gateway.computeHashes()
      : await computeWorkspaceHashes(options.workspacePath));

  const snapshot = await captureEditRunSnapshot(options);
  const beforeFiles = await captureBeforeFiles(options);
  const afterFiles: Record<string, string> = { ...beforeFiles };
  const changedFiles: string[] = [];
  const summaries: string[] = [];

  const toolCtx: DomainToolContext = {
    editContext,
    agentOptions: options,
    changedFiles,
    beforeFiles,
    afterFiles,
  };

  for (const step of plan.steps) {
    const result = await executeStep(step, toolCtx);
    if (!result.ok) {
      await rollbackChangedFiles(options, snapshot, changedFiles);
      return {
        ok: false,
        error: result.error,
        ownerMessage: result.error ?? 'Edit could not be applied safely.',
        strategy: step.skill === 'update_section_style' ? 'section_style' : 'section_config',
        tier: 'L1',
        confidence: plan.risk?.level ?? 'medium',
        verifyProfile: step.skill === 'update_section_style' ? 'color' : 'generic',
        changedFiles: [],
      };
    }
    if (result.summary) summaries.push(result.summary);
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const computedChanged = getChangedFilesFromHashes(initialHashes, afterHashes);

  const summaryResult = await executeDomainTool('summarize_actual_changes', toolCtx, {});
  const ownerMessage = summaryResult.summary || summaries.join(' ') || 'Updated your website.';

  return {
    ok: true,
    summary: ownerMessage,
    ownerMessage,
    changedFiles: computedChanged.length > 0 ? computedChanged : changedFiles,
    strategy:
      plan.steps[0]?.skill === 'update_section_style'
        ? 'section_style'
        : plan.steps[0]?.skill === 'update_contact'
          ? 'contact_field'
          : 'section_config',
    tier: 'L0',
    confidence: plan.risk?.level === 'high' ? 'medium' : 'high',
    verifyProfile:
      plan.intent === 'style'
        ? 'color'
        : plan.intent === 'contact'
          ? 'contact'
          : 'generic',
    v3Meta: {
      planVersion: plan.planVersion ?? 'website-agent-v3',
      intent: plan.intent,
      skills: plan.steps.map((s) => s.skill),
    },
  };
}

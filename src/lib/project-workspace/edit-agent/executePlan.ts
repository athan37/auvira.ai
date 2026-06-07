import {
  PAGE_TSX,
  SITE_CONFIG,
  GLOBALS_CSS,
  readWorkspaceRel,
} from '@/lib/project-workspace/edit-shared/strategyContext';
import { computeWorkspaceHashes, getChangedFilesFromHashes } from '@/lib/project-workspace/workspaceEditShared';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import {
  buildVerificationContractFromPlan,
  mergeVerificationContracts,
} from '@/lib/project-workspace/edit-context/buildVerificationContractFromPlan';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import { clarificationAnchorFromTarget } from '@/lib/project-workspace/edit-context/clarificationAnchor';
import {
  defaultGuidanceHints,
  formatAmbiguityClarification,
  assessEditAmbiguity,
} from '@/lib/project-workspace/edit-context/assessEditAmbiguity';
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
    const assessment = assessEditAmbiguity(editContext);
    const ownerMessage =
      plan.clarificationQuestion ?? 'What should I change? Please provide more detail.';
    return {
      ok: false,
      needsClarification: true,
      ownerMessage,
      error: ownerMessage,
      suggestedReplies: plan.suggestedReplies,
      guidanceHints:
        assessment.guidanceHints.length > 0 ? assessment.guidanceHints : defaultGuidanceHints(),
      ambiguityReasons:
        assessment.reasons.length > 0 ? assessment.reasons : ['low_confidence_target'],
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      verifyProfile: 'generic',
      clarificationAnchor: clarificationAnchorFromTarget(editContext.target),
    };
  }

  if (plan.steps.length === 0) {
    const formatted = formatAmbiguityClarification(['missing_what']);
    return {
      ok: false,
      needsClarification: true,
      error: 'Empty edit plan',
      ownerMessage: formatted.message,
      suggestedReplies: formatted.suggestedReplies,
      guidanceHints: defaultGuidanceHints(),
      ambiguityReasons: ['missing_what'],
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

  const planVerification = buildVerificationContractFromPlan(plan, editContext.effectiveMessage);
  const editContextWithPlanChecks: EditContext = {
    ...editContext,
    verificationContract: mergeVerificationContracts(
      editContext.verificationContract,
      planVerification
    ),
  };

  const toolCtx: DomainToolContext = {
    editContext: editContextWithPlanChecks,
    agentOptions: options,
    changedFiles,
    beforeFiles,
    afterFiles,
  };

  for (const step of plan.steps) {
    const result = await executeStep(step, toolCtx, { deferInvariantVerify: plan.steps.length > 1 });
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

  if (plan.steps.length > 1) {
    const finalVerify = await executeDomainTool('verify_source_invariants', toolCtx, {});
    if (!finalVerify.ok) {
      await rollbackChangedFiles(options, snapshot, changedFiles);
      return {
        ok: false,
        error: finalVerify.invariantErrors?.join('; '),
        ownerMessage: finalVerify.invariantErrors?.join('; ') ?? 'Verification failed after edit.',
        strategy: 'section_config',
        tier: 'L1',
        confidence: plan.risk?.level ?? 'medium',
        verifyProfile: 'generic',
        changedFiles: [],
      };
    }
  }

  const summaryResult = await executeDomainTool('summarize_actual_changes', toolCtx, {});
  const finalChanged = computedChanged.length > 0 ? computedChanged : changedFiles;

  const styleIntent =
    plan.intent === 'style' ||
    plan.steps.some((s) => s.skill === 'update_section_style' || s.skill === 'update_theme');

  if (finalChanged.length === 0) {
    await rollbackChangedFiles(options, snapshot, changedFiles);

    if (!styleIntent) {
      const ownerMessage =
        summaryResult.summary ||
        summaries.join(' ') ||
        'No changes were needed — that value is already set.';
      return {
        ok: true,
        summary: ownerMessage,
        ownerMessage,
        changedFiles: [],
        strategy:
          plan.steps[0]?.skill === 'update_contact'
            ? 'contact_field'
            : 'section_config',
        tier: 'L0',
        confidence: 'high',
        verifyProfile: plan.intent === 'contact' ? 'contact' : 'generic',
        editMeta: {
          planVersion: plan.planVersion ?? 'website-agent',
          intent: plan.intent,
          skills: plan.steps.map((s) => s.skill),
        },
      };
    }

    const formatted = formatAmbiguityClarification(['missing_value'], {
      clarificationMessage:
        'Sorry — your request was too ambiguous for me to apply safely.\n\n' +
        'I could not find any file changes to make. Try pinning the section from the preview, ' +
        'or describe what to change (background, text, copy) and the exact value.',
      suggestedReplies: editContext.sectionCatalog.numberedReplies.slice(0, 3),
    });
    return {
      ok: false,
      needsClarification: true,
      error: 'No files were modified',
      ownerMessage: formatted.message,
      suggestedReplies: formatted.suggestedReplies,
      guidanceHints: defaultGuidanceHints(),
      ambiguityReasons: ['missing_value'],
      strategy: 'section_config',
      tier: 'L3',
      confidence: 'low',
      verifyProfile: 'generic',
      changedFiles: [],
      clarificationAnchor: clarificationAnchorFromTarget(editContext.target),
    };
  }

  const ownerMessage = summaryResult.summary || summaries.join(' ') || 'Updated your website.';

  const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
  const themeStep = plan.steps.find((s) => s.skill === 'update_theme');
  const editFocus =
    themeStep && editContext.target.kind === 'hero'
      ? {
          kind: 'hero' as const,
          sectionIndex: -1,
          sectionTitle: 'Hero',
          sectionType: 'hero',
          at: new Date().toISOString(),
        }
      : styleStep && editContext.target.sectionIndex != null
      ? {
          kind: 'section_style' as const,
          sectionIndex: editContext.target.sectionIndex,
          sectionTitle:
            editContext.target.title ??
            editContext.sections.find((s) => s.index === editContext.target.sectionIndex)?.title ??
            `section ${editContext.target.sectionIndex}`,
          sectionType:
            editContext.target.sectionType ??
            editContext.sections.find((s) => s.index === editContext.target.sectionIndex)?.type,
          backgroundClass:
            typeof styleStep.params?.backgroundClass === 'string'
              ? styleStep.params.backgroundClass
              : undefined,
          at: new Date().toISOString(),
        }
      : undefined;

  return {
    ok: true,
    summary: ownerMessage,
    ownerMessage,
    changedFiles: finalChanged,
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
    editFocus,
    editMeta: {
      planVersion: plan.planVersion ?? 'website-agent',
      intent: plan.intent,
      skills: plan.steps.map((s) => s.skill),
    },
  };
}

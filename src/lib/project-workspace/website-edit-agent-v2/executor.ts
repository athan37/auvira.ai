import { computeWorkspaceHashes, getChangedFilesFromHashes } from '../workspaceEditShared';
import { runWebsiteEditAgent } from '../website-edit-agent';
import { runStrategyById } from '../website-edit-agent/strategyRegistry';
import {
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../website-edit-agent/strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../website-edit-agent/types';
import type { EditPlan, EditPlanStep, V2SkillName } from './editPlanSchema';
import {
  captureEditRunSnapshot,
  repairEditRun,
  rollbackEditRun,
  verifyEditRun,
} from './lifecycle';
import { extractColorsFromMessage } from '../website-edit-agent/preset/presetUtils';
import {
  addSectionToSource,
  addServiceToSource,
  updateContactFieldInSource,
  updateHeroFieldInSource,
  updateSectionBackgroundColorInSource,
  updateSectionPresentationInSource,
} from './siteConfigMutations';
import {
  colorNameToCardClass,
  type SiteSectionPresentation,
} from '@/lib/builder/sectionPresentation';
import { buildSiteModel } from './siteModel';
import { normalizeSectionStyleStep } from './normalizeSectionStyleStep';
import {
  ensureLegacyPageReadsPresentation,
  rendererComponentForSectionType,
} from '../website-edit-agent/legacySectionPresentation';
import type { SiteModel } from './siteModel';

async function wireSectionPresentationPreview(
  options: WebsiteEditAgentOptions,
  sectionIndex: number,
  siteModel: SiteModel
): Promise<void> {
  const section = siteModel.sections.find((s) => s.index === sectionIndex);
  if (!section) return;
  const componentName = rendererComponentForSectionType(section.type);
  await ensureLegacyPageReadsPresentation(options, componentName);
}

export interface ExecuteSkillResult {
  ok: boolean;
  skill: V2SkillName;
  summary?: string;
  changed?: boolean;
  error?: string;
}

function getStringArg(step: EditPlanStep, key: string): string | null {
  const value = step.args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNumberArg(step: EditPlanStep, key: string): number | null {
  const value = step.args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unsupportedSkill(step: EditPlanStep): ExecuteSkillResult {
  return {
    ok: false,
    skill: step.skill,
    error: `Website Agent V2 does not support ${step.skill} yet.`,
  };
}

async function executeLegacyWrapper(
  step: EditPlanStep,
  options: WebsiteEditAgentOptions
): Promise<ExecuteSkillResult> {
  if (step.skill === 'update_theme') {
    const beforeHashes = options.gateway
      ? await options.gateway.computeHashes()
      : await computeWorkspaceHashes(options.workspacePath);
    const result = await runStrategyById('preset_theme', options, beforeHashes);
    return {
      ok: result?.ok ?? false,
      skill: step.skill,
      changed: result?.ok ?? false,
      summary: result?.summary ?? result?.ownerMessage,
      error: result?.error ?? 'Legacy theme strategy did not apply.',
    };
  }

  const result = await runWebsiteEditAgent(options);
  return {
    ok: result.ok,
    skill: step.skill,
    changed: result.ok,
    summary: result.summary ?? result.ownerMessage,
    error: result.error,
  };
}

async function updateSiteConfig(
  options: WebsiteEditAgentOptions,
  update: (content: string) => string | null
): Promise<boolean> {
  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return false;

  const updated = update(content);
  if (!updated || updated === content) return false;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);
  return true;
}

/**
 * Execute one Website Agent V2-native skill against config-driven site files.
 */
export async function executeSkill(
  step: EditPlanStep,
  options: WebsiteEditAgentOptions
): Promise<ExecuteSkillResult> {
  if (step.skill === 'clarify') {
    return { ok: true, skill: step.skill, changed: false };
  }

  if (options.mode !== 'gitlab') {
    return {
      ok: false,
      skill: step.skill,
      error: 'Website Agent V2 config skills currently require a GitLab/Next workspace.',
    };
  }

  if (step.skill === 'update_hero') {
    const field = getStringArg(step, 'field');
    const value = getStringArg(step, 'value');
    if (!field || !value) {
      return { ok: false, skill: step.skill, error: 'update_hero requires field and value.' };
    }
    const changed = await updateSiteConfig(options, (content) =>
      updateHeroFieldInSource(content, field, value)
    );
    return {
      ok: changed,
      skill: step.skill,
      changed,
      summary: changed ? `Updated hero ${field} to "${value}".` : undefined,
      error: changed ? undefined : 'No hero field change was applied.',
    };
  }

  if (step.skill === 'update_contact') {
    const field = getStringArg(step, 'field');
    const value = getStringArg(step, 'value');
    if (!field || !value) {
      return { ok: false, skill: step.skill, error: 'update_contact requires field and value.' };
    }
    const changed = await updateSiteConfig(options, (content) =>
      updateContactFieldInSource(content, field, value)
    );
    return {
      ok: changed,
      skill: step.skill,
      changed,
      summary: changed ? `Updated ${field} to ${value}.` : undefined,
      error: changed ? undefined : 'No contact field change was applied.',
    };
  }

  if (step.skill === 'add_service') {
    const title = getStringArg(step, 'title');
    if (!title) {
      return { ok: false, skill: step.skill, error: 'add_service requires title.' };
    }
    const description = getStringArg(step, 'description') ?? undefined;
    const changed = await updateSiteConfig(options, (content) =>
      addServiceToSource(content, { title, description })
    );
    return {
      ok: changed,
      skill: step.skill,
      changed,
      summary: changed ? `Added ${title} to services.` : undefined,
      error: changed ? undefined : 'No service change was applied.',
    };
  }

  if (step.skill === 'update_section_style') {
    const siteModel = await buildSiteModel(options);
    const normalizedStep = normalizeSectionStyleStep(
      step,
      options.ownerMessage,
      siteModel
    );

    const sectionIndex = getNumberArg(normalizedStep, 'sectionIndex');
    if (sectionIndex == null || sectionIndex < 0) {
      return {
        ok: false,
        skill: step.skill,
        error: 'update_section_style requires sectionIndex.',
      };
    }

    const backgroundColor =
      getStringArg(normalizedStep, 'backgroundColor') ?? getStringArg(normalizedStep, 'color');
    const presentationArg = normalizedStep.args.presentation;
    const presentation: Partial<SiteSectionPresentation> =
      presentationArg && typeof presentationArg === 'object' && !Array.isArray(presentationArg)
        ? (presentationArg as Partial<SiteSectionPresentation>)
        : {};

    const cardColor = getStringArg(normalizedStep, 'cardColor');
    if (cardColor && !presentation.cardClass) {
      presentation.cardClass = colorNameToCardClass(cardColor);
    }

    if (backgroundColor) {
      const changed = await updateSiteConfig(options, (content) =>
        updateSectionBackgroundColorInSource(content, sectionIndex, backgroundColor)
      );
      if (changed) {
        await wireSectionPresentationPreview(options, sectionIndex, siteModel);
      }
      return {
        ok: changed,
        skill: step.skill,
        changed,
        summary: changed
          ? `Set section ${sectionIndex} background to ${backgroundColor}.`
          : undefined,
        error: changed ? undefined : 'No section presentation change was applied.',
      };
    }

    if (Object.keys(presentation).length === 0) {
      const colors = extractColorsFromMessage(options.ownerMessage);
      const fallbackColor = colors.at(-1);
      if (fallbackColor && /\bcard/.test(options.ownerMessage.toLowerCase())) {
        presentation.cardClass = colorNameToCardClass(fallbackColor);
      } else if (fallbackColor) {
        const changed = await updateSiteConfig(options, (content) =>
          updateSectionBackgroundColorInSource(content, sectionIndex, fallbackColor)
        );
        if (changed) {
          await wireSectionPresentationPreview(options, sectionIndex, siteModel);
        }
        return {
          ok: changed,
          skill: step.skill,
          changed,
          summary: changed
            ? `Set section ${sectionIndex} background to ${fallbackColor}.`
            : undefined,
          error: changed ? undefined : 'No section presentation change was applied.',
        };
      }
      return {
        ok: false,
        skill: step.skill,
        error: 'update_section_style requires backgroundColor or presentation object.',
      };
    }

    const changed = await updateSiteConfig(options, (content) =>
      updateSectionPresentationInSource(content, sectionIndex, presentation)
    );
    if (changed) {
      await wireSectionPresentationPreview(options, sectionIndex, siteModel);
    }
    return {
      ok: changed,
      skill: step.skill,
      changed,
      summary: changed ? `Updated presentation for section ${sectionIndex}.` : undefined,
      error: changed ? undefined : 'No section presentation change was applied.',
    };
  }

  if (step.skill === 'add_section') {
    const title = getStringArg(step, 'title');
    if (!title) {
      return { ok: false, skill: step.skill, error: 'add_section requires title.' };
    }
    const type = getStringArg(step, 'type') ?? undefined;
    const body = getStringArg(step, 'body') ?? undefined;
    const items = Array.isArray(step.args.items) ? step.args.items : undefined;
    const changed = await updateSiteConfig(options, (content) =>
      addSectionToSource(content, { type, title, body, items })
    );
    return {
      ok: changed,
      skill: step.skill,
      changed,
      summary: changed ? `Added ${title} section.` : undefined,
      error: changed ? undefined : 'No section change was applied.',
    };
  }

  if (
    step.skill === 'legacy_strategy' ||
    step.skill === 'update_theme' ||
    step.skill === 'update_image'
  ) {
    return executeLegacyWrapper(step, options);
  }

  return unsupportedSkill(step);
}

/**
 * Execute a V2 edit plan and return the stable WebsiteEditAgentResult contract.
 */
export async function executePlan(
  plan: EditPlan,
  options: WebsiteEditAgentOptions,
  beforeHashes?: Record<string, string>
): Promise<WebsiteEditAgentResult> {
  if (plan.needsClarification || plan.steps.some((step) => step.skill === 'clarify')) {
    const ownerMessage =
      plan.clarificationQuestion ??
      plan.summary ??
      'What should I change? Please provide the target and exact new value.';
    return {
      ok: false,
      needsClarification: true,
      ownerMessage,
      error: ownerMessage,
      suggestedReplies: plan.suggestedReplies,
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: 'low',
      verifyProfile: 'generic',
    };
  }

  const initialHashes =
    beforeHashes ??
    (options.gateway ? await options.gateway.computeHashes() : await computeWorkspaceHashes(options.workspacePath));
  const summaries: string[] = [];
  const snapshot = await captureEditRunSnapshot(options);
  let usedLegacyWrapper = false;

  for (const step of plan.steps) {
    const result = await executeSkill(step, options);
    usedLegacyWrapper =
      usedLegacyWrapper ||
      step.skill === 'legacy_strategy' ||
      step.skill === 'update_theme' ||
      step.skill === 'update_image';
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        ownerMessage:
          result.error ??
          'Website Agent V2 could not safely apply that change. Please try a more specific request.',
        strategy: 'agent_loop',
        tier: 'L3',
        confidence: plan.confidence,
        verifyProfile: 'generic',
        v2Meta: {
          planIntent: plan.intent,
          planRoute: plan.route,
          skills: plan.steps.map((s) => s.skill),
          usedLegacyWrapper,
        },
      };
    }
    if (result.summary) summaries.push(result.summary);
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(initialHashes, afterHashes);

  if (changedFiles.length === 0) {
    return {
      ok: false,
      error: 'Website Agent V2 plan completed without file changes.',
      ownerMessage: 'No website files were changed. Please try a more specific request.',
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: plan.confidence,
      verifyProfile: 'generic',
      v2Meta: {
        planIntent: plan.intent,
        planRoute: plan.route,
        skills: plan.steps.map((step) => step.skill),
        usedLegacyWrapper,
      },
    };
  }

  const repair = await repairEditRun(options, changedFiles, plan);
  if (!repair.ok) {
    const restored = await rollbackEditRun(options, snapshot, changedFiles);
    return {
      ok: false,
      error: repair.reason,
      ownerMessage:
        'Website Agent V2 could not safely repair the edit, so the changed files were rolled back.',
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: plan.confidence,
      verifyProfile: 'generic',
      changedFiles: restored,
      v2Meta: {
        planIntent: plan.intent,
        planRoute: plan.route,
        skills: plan.steps.map((step) => step.skill),
        usedLegacyWrapper,
        repair: { ok: false, action: repair.action, reason: repair.reason },
        rolledBack: true,
      },
    };
  }

  const verification = await verifyEditRun(plan, options, snapshot, changedFiles);
  if (!verification.ok) {
    return {
      ok: false,
      error: verification.reason,
      ownerMessage: 'Website Agent V2 could not verify that the requested edit was applied.',
      strategy: 'agent_loop',
      tier: 'L3',
      confidence: plan.confidence,
      verifyProfile: 'generic',
      changedFiles,
      v2Meta: {
        planIntent: plan.intent,
        planRoute: plan.route,
        skills: plan.steps.map((step) => step.skill),
        usedLegacyWrapper,
        verification: { ok: false, reason: verification.reason },
        repair: { ok: true, action: repair.action, reason: repair.reason },
      },
    };
  }

  const summary = plan.summary ?? (summaries.join(' ') || 'Updated your website.');
  return {
    ok: true,
    summary,
    ownerMessage: summary,
    changedFiles,
    strategy: plan.route === 'contact' ? 'contact_field' : plan.route === 'hero' ? 'copy_field' : 'section_config',
    tier: 'L1',
    confidence: plan.confidence,
    verifyProfile: plan.route === 'contact' ? 'contact' : plan.route === 'sections' ? 'section' : 'copy',
    v2Meta: {
      planIntent: plan.intent,
      planRoute: plan.route,
      skills: plan.steps.map((step) => step.skill),
      usedLegacyWrapper,
      verification: { ok: true, reason: verification.reason },
      repair: { ok: true, action: repair.action, reason: repair.reason },
      rolledBack: false,
    },
  };
}


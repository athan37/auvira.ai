import {
  colorNameToCardClass,
} from '@/lib/builder/sectionPresentation';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  GLOBALS_CSS,
  PAGE_TSX,
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../website-edit-agent/strategyContext';
import { detectScopedStyleRequest } from '../website-edit-agent/editAmbiguity';
import { extractColorsFromMessage } from '../website-edit-agent/preset/presetUtils';
import type { WebsiteEditAgentOptions } from '../website-edit-agent/types';
import { verifyEditApplied } from '../website-edit-agent/verifyEditApplied';
import type { EditPlan } from './editPlanSchema';
import { buildSiteModel } from './siteModel';
import { resolveSectionIndexFromMessage } from './normalizeSectionStyleStep';
import {
  migrateSubtitleStyleMarkersInSource,
  updateSectionPresentationInSource,
} from './siteConfigMutations';
import {
  applySectionBackgroundEdit,
  sectionBackgroundEditFromAgentOptions,
} from '../sectionPresentationEdit';

const SNAPSHOT_PATHS = [SITE_CONFIG, PAGE_TSX, GLOBALS_CSS] as const;

export interface EditRunSnapshot {
  files: Record<string, string>;
}

export interface RepairEditRunResult {
  ok: boolean;
  action: 'not_needed' | 'repaired' | 'failed';
  reason?: string;
}

export interface VerifyEditRunResult {
  ok: boolean;
  reason: string;
  evidence: string[];
}

function stepValues(plan: EditPlan): string[] {
  return plan.steps
    .flatMap((step) => ['value', 'title', 'description', 'body'].map((key) => step.args[key]))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

async function captureFiles(
  options: WebsiteEditAgentOptions,
  paths: readonly string[]
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const filePath of paths) {
    const content = await readWorkspaceRel(options, filePath);
    if (content !== null) {
      files[filePath] = content;
    }
  }
  return files;
}

/**
 * Capture pre-edit files needed for verification and rollback.
 */
export async function captureEditRunSnapshot(
  options: WebsiteEditAgentOptions
): Promise<EditRunSnapshot> {
  return { files: await captureFiles(options, SNAPSHOT_PATHS) };
}

async function repairMissingSectionPresentation(
  options: WebsiteEditAgentOptions,
  plan: EditPlan | undefined,
  content: string
): Promise<RepairEditRunResult | null> {
  const stylePlanned = plan?.steps.some((step) => step.skill === 'update_section_style');
  if (!stylePlanned && !detectScopedStyleRequest(options.ownerMessage)) {
    return null;
  }
  if (/presentation\s*:\s*\{/.test(content)) {
    return null;
  }

  const siteModel = await buildSiteModel(options);
  const sectionIndex = resolveSectionIndexFromMessage(options.ownerMessage, siteModel.sections);
  const colors = extractColorsFromMessage(options.ownerMessage);
  const color = colors.at(-1);
  if (sectionIndex == null || !color) {
    return null;
  }

  const wantsCard = /\bcard(s)?\b/i.test(options.ownerMessage);
  if (wantsCard) {
    const updated = updateSectionPresentationInSource(content, sectionIndex, {
      cardClass: colorNameToCardClass(color),
    });
    if (!updated || updated === content) return null;
    await writeWorkspaceRel(options, SITE_CONFIG, updated);
    return {
      ok: true,
      action: 'repaired',
      reason: 'Applied section.presentation card tokens after style edit.',
    };
  }

  const section = siteModel.sections.find((s) => s.index === sectionIndex);
  const pipeline = await applySectionBackgroundEdit(
    sectionBackgroundEditFromAgentOptions(
      options,
      {
        sectionIndex,
        sectionType: section?.type ?? 'generic',
        title: section?.title,
      },
      color
    )
  );
  if (!pipeline.ok) return null;

  return {
    ok: true,
    action: 'repaired',
    reason: pipeline.summary || 'Applied section.presentation tokens after style edit.',
  };
}

/**
 * Validate and repair common V2 edit output issues before verification.
 */
export async function repairEditRun(
  options: WebsiteEditAgentOptions,
  changedFiles: string[],
  plan?: EditPlan
): Promise<RepairEditRunResult> {
  if (!changedFiles.includes(SITE_CONFIG)) {
    return { ok: true, action: 'not_needed' };
  }

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) {
    return { ok: false, action: 'failed', reason: 'siteConfig.ts is missing after edit.' };
  }

  const migratedSubtitle = migrateSubtitleStyleMarkersInSource(content);
  if (migratedSubtitle && migratedSubtitle !== content) {
    await writeWorkspaceRel(options, SITE_CONFIG, migratedSubtitle);
    return {
      ok: true,
      action: 'repaired',
      reason: 'Migrated subtitle style markers to section.presentation.',
    };
  }

  const presentationRepair = await repairMissingSectionPresentation(options, plan, content);
  if (presentationRepair) {
    return presentationRepair;
  }

  if (parseSiteConfigSource(content)) {
    return { ok: true, action: 'not_needed' };
  }

  const withSemicolon = content.trimEnd().endsWith(';') ? content : `${content.trimEnd()};\n`;
  if (withSemicolon !== content && parseSiteConfigSource(withSemicolon)) {
    await writeWorkspaceRel(options, SITE_CONFIG, withSemicolon);
    return { ok: true, action: 'repaired', reason: 'Added missing siteConfig semicolon.' };
  }

  return {
    ok: false,
    action: 'failed',
    reason: 'siteConfig.ts could not be parsed after the edit.',
  };
}

/**
 * Restore pre-edit files when repair cannot produce a safe workspace.
 */
export async function rollbackEditRun(
  options: WebsiteEditAgentOptions,
  snapshot: EditRunSnapshot,
  changedFiles: string[]
): Promise<string[]> {
  const restored: string[] = [];
  for (const filePath of changedFiles) {
    const content = snapshot.files[filePath];
    if (content === undefined) continue;
    await writeWorkspaceRel(options, filePath, content);
    restored.push(filePath);
  }
  return restored;
}

/**
 * Verify that a V2 edit run changed files in a way that matches its plan.
 */
export async function verifyEditRun(
  plan: EditPlan,
  options: WebsiteEditAgentOptions,
  snapshot: EditRunSnapshot,
  changedFiles: string[]
): Promise<VerifyEditRunResult> {
  const afterFiles = await captureFiles(options, Array.from(new Set([...SNAPSHOT_PATHS, ...changedFiles])));
  const values = stepValues(plan);
  const combinedAfter = Object.values(afterFiles).join('\n').toLowerCase();

  for (const value of values) {
    if (!combinedAfter.includes(value.toLowerCase())) {
      return {
        ok: false,
        reason: `Expected edited content to include "${value}".`,
        evidence: [`Missing planned value for ${plan.route}`],
      };
    }
  }

  const deterministic = verifyEditApplied(options.ownerMessage, snapshot.files, {
    ...snapshot.files,
    ...afterFiles,
  });

  const siteConfigAfter = afterFiles[SITE_CONFIG] ?? '';
  const stylePlanned = plan.steps.some((step) => step.skill === 'update_section_style');
  if (!deterministic.ok && stylePlanned && /presentation/.test(siteConfigAfter)) {
    return {
      ok: true,
      reason: 'Section presentation updated in siteConfig.',
      evidence: ['presentation tokens present after update_section_style'],
    };
  }

  if (deterministic.ok || plan.route === 'contact' || plan.route === 'hero') {
    return {
      ok: true,
      reason: deterministic.ok ? deterministic.reason : 'Planned value found in edited files.',
      evidence: deterministic.evidence,
    };
  }

  return deterministic;
}


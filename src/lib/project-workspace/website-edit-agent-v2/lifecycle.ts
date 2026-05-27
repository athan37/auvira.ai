import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  GLOBALS_CSS,
  PAGE_TSX,
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../website-edit-agent/strategyContext';
import type { WebsiteEditAgentOptions } from '../website-edit-agent/types';
import { verifyEditApplied } from '../website-edit-agent/verifyEditApplied';
import type { EditPlan } from './editPlanSchema';

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

/**
 * Validate and repair common V2 edit output issues before verification.
 */
export async function repairEditRun(
  options: WebsiteEditAgentOptions,
  changedFiles: string[]
): Promise<RepairEditRunResult> {
  if (!changedFiles.includes(SITE_CONFIG)) {
    return { ok: true, action: 'not_needed' };
  }

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) {
    return { ok: false, action: 'failed', reason: 'siteConfig.ts is missing after edit.' };
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

  if (deterministic.ok || plan.route === 'contact' || plan.route === 'hero') {
    return {
      ok: true,
      reason: deterministic.ok ? deterministic.reason : 'Planned value found in edited files.',
      evidence: deterministic.evidence,
    };
  }

  return deterministic;
}


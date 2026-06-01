import { expect } from 'vitest';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';
import {
  colorNameToBackgroundClass,
  extractSectionBackgroundClassFromMessage,
} from '@/lib/builder/sectionPresentation';
import { assertExactSectionBackgroundInSiteConfig } from '../support/sectionColorEditContract';
import { readSyntheticFile } from '../support/syntheticSiteWorkspace';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';

export {
  confusingTitlesSiteSpec,
  similarVerbSiteSpec,
} from '../support/hardCatalogSiteSpecs';

export function parseSections(siteConfig: string): Array<Record<string, unknown>> {
  const literal = extractSiteConfigObjectLiteral(siteConfig);
  if (!literal) return [];
  try {
    const parsed = new Function(`return (${literal})`)() as { sections?: unknown[] };
    return Array.isArray(parsed.sections)
      ? (parsed.sections as Array<Record<string, unknown>>)
      : [];
  } catch {
    return [];
  }
}

export function sectionBackgroundClass(section: Record<string, unknown>): string | undefined {
  const presentation = section.presentation as Record<string, unknown> | undefined;
  return typeof presentation?.backgroundClass === 'string'
    ? presentation.backgroundClass
    : undefined;
}

export function sectionCardClass(section: Record<string, unknown>): string | undefined {
  const presentation = section.presentation as Record<string, unknown> | undefined;
  return typeof presentation?.cardClass === 'string' ? presentation.cardClass : undefined;
}

/** siteConfig source must be byte-identical (no mutation on clarify). */
export function assertSiteConfigUnchanged(before: string, after: string): void {
  expect(after, 'siteConfig must not change').toBe(before);
}

/** Require a successful edit with no clarification. */
export function assertV3EditSucceeded(result: WebsiteEditAgentResult, hint?: string): void {
  const detail = hint ?? result.error ?? result.ownerMessage ?? result.summary ?? '';
  expect(result.needsClarification, detail).toBeFalsy();
  expect(result.ok, detail).toBe(true);
}

export function assertSectionBackgroundMatchesColor(
  siteConfig: string,
  sectionIndex: number,
  expected: { type: string; title: string; color: string }
): void {
  const config = parseSections(siteConfig);
  const section = config[sectionIndex];
  if (!section) {
    throw new Error(`siteConfig has no section at index ${sectionIndex}`);
  }
  if (String(section.type) !== expected.type) {
    throw new Error(
      `Expected section ${sectionIndex} type "${expected.type}", got "${String(section.type)}"`
    );
  }
  if (String(section.title) !== expected.title) {
    throw new Error(
      `Expected section ${sectionIndex} title "${expected.title}", got "${String(section.title)}"`
    );
  }
  const bg = sectionBackgroundClass(section) ?? '';
  const color = expected.color.toLowerCase();
  if (!bg.toLowerCase().includes(color)) {
    throw new Error(
      `Expected section ${sectionIndex} background to include "${color}", got "${bg}"`
    );
  }
}

/** Assert exact background on one section and that other indices stayed unchanged. */
export async function assertV3SectionBackgroundEdit(
  workspacePath: string,
  options: {
    targetIndex: number;
    targetType: string;
    targetTitle: string;
    ownerMessage: string;
    color?: string;
    unchangedIndices?: number[];
    /** When true, accept any Tailwind shade for the color (bg-red-500 vs bg-red-600). */
    colorFamily?: boolean;
  }
): Promise<void> {
  const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
  const expectedClass =
    extractSectionBackgroundClassFromMessage(options.ownerMessage) ??
    (options.color ? colorNameToBackgroundClass(options.color, options.ownerMessage) : null);

  if (!expectedClass && !options.color) {
    throw new Error(`Could not derive expected backgroundClass from: ${options.ownerMessage}`);
  }

  if (options.colorFamily && options.color) {
    assertSectionBackgroundMatchesColor(siteConfig, options.targetIndex, {
      type: options.targetType,
      title: options.targetTitle,
      color: options.color,
    });
  } else if (expectedClass) {
    assertExactSectionBackgroundInSiteConfig(siteConfig, options.targetIndex, {
      type: options.targetType,
      title: options.targetTitle,
      backgroundClass: expectedClass,
    });
  }

  const sections = parseSections(siteConfig);
  const appliedBg = sectionBackgroundClass(sections[options.targetIndex] ?? {}) ?? '';
  for (const index of options.unchangedIndices ?? []) {
    const bg = sectionBackgroundClass(sections[index] ?? {});
    if (appliedBg && bg === appliedBg) {
      expect(bg, `section ${index} must not receive ${appliedBg}`).not.toBe(appliedBg);
    }
  }
}

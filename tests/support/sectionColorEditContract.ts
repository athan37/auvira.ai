/**
 * Generic contract runner for section background edits — no site-specific fixtures.
 */

import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';
import { rendererComponentForSectionType } from '@/lib/project-workspace/edit-shared/legacySectionPresentation';
import {
  applySectionBackgroundEdit,
  type ApplySectionBackgroundEditResult,
} from '@/lib/project-workspace/sectionPresentationEdit';
import { sectionRendererUsesPresentationResolver } from '@/lib/project-workspace/previewReflectsSiteConfig';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  type PageRendererMode,
  type SyntheticSectionType,
} from './syntheticSiteWorkspace';

export type SectionColorEditScenario = {
  name: string;
  sectionType: SyntheticSectionType | string;
  sectionIndex?: number;
  color: string;
  ownerMessage?: string;
  pageMode: PageRendererMode;
  infraBaselineReady: boolean;
  tailwind?: 'canonical' | 'minimal';
  /** When infra ready + wired page, expect only siteConfig to change. */
  expectFiles?: {
    mustInclude?: string[];
    mustExclude?: string[];
  };
};

export type SectionColorEditContractResult = {
  scenario: SectionColorEditScenario;
  workspacePath: string;
  pipeline: ApplySectionBackgroundEditResult;
  siteConfig: string;
  page: string;
};

function defaultMessage(sectionTitle: string, color: string): string {
  return `change background of "${sectionTitle}" to ${color}`;
}

function parseSiteConfigRecord(content: string): Record<string, unknown> | null {
  const literal = extractSiteConfigObjectLiteral(content);
  if (!literal) return null;
  try {
    const parsed = new Function(`return (${literal})`)();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Assert presentation.backgroundClass on the exact section index/type/title. */
export function assertExactSectionBackgroundInSiteConfig(
  siteConfig: string,
  sectionIndex: number,
  expected: { type: string; title: string; backgroundClass: string }
): void {
  const config = parseSiteConfigRecord(siteConfig);
  const sections = Array.isArray(config?.sections)
    ? (config!.sections as Array<Record<string, unknown>>)
    : null;
  const section = sections?.[sectionIndex];
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
  const presentation = section.presentation as Record<string, unknown> | undefined;
  const backgroundClass = presentation?.backgroundClass;
  if (backgroundClass !== expected.backgroundClass) {
    throw new Error(
      `Expected section ${sectionIndex} backgroundClass "${expected.backgroundClass}", got "${String(backgroundClass)}"`
    );
  }
}

/** Run one generic section-color contract scenario end-to-end. */
export async function runSectionColorEditContract(
  scenario: SectionColorEditScenario
): Promise<SectionColorEditContractResult> {
  const sectionIndex = scenario.sectionIndex ?? 0;
  const title = `Section ${sectionIndex + 1} (${scenario.sectionType})`;

  const workspacePath = await createSyntheticWorkspace({
    site: {
      sections: [{ type: scenario.sectionType, title }],
    },
    pageMode: scenario.pageMode,
    tailwind: scenario.tailwind ?? (scenario.infraBaselineReady ? 'canonical' : 'minimal'),
  });

  const ownerMessage =
    scenario.ownerMessage ?? defaultMessage(title, scenario.color);
  const expectedClass = colorNameToBackgroundClass(scenario.color, ownerMessage);

  const pipeline = await applySectionBackgroundEdit({
    workspace: { workspacePath, ownerMessage },
    sectionTarget: {
      sectionIndex,
      sectionType: String(scenario.sectionType),
      title,
    },
    colorName: scenario.color,
    projectInfraStatus: { infraBaselineReady: scenario.infraBaselineReady },
  });

  const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
  const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');

  return { scenario, workspacePath, pipeline, siteConfig, page };
}

/** Assert generic invariants for a contract run (throws via expect in tests). */
export function assertSectionColorEditContract(result: SectionColorEditContractResult): void {
  const { scenario, pipeline, siteConfig, page } = result;
  const sectionIndex = scenario.sectionIndex ?? 0;
  const title = `Section ${sectionIndex + 1} (${scenario.sectionType})`;
  const ownerMessage = scenario.ownerMessage ?? defaultMessage(title, scenario.color);
  const expectedClass = colorNameToBackgroundClass(scenario.color, ownerMessage);
  const sectionType = String(scenario.sectionType);
  const component = rendererComponentForSectionType(sectionType);

  if (!pipeline.ok) {
    throw new Error(
      `Pipeline failed for "${scenario.name}": ${pipeline.invariantErrors.join('; ')}`
    );
  }

  if (pipeline.backgroundClass !== expectedClass) {
    throw new Error(
      `Expected class ${expectedClass}, got ${pipeline.backgroundClass}`
    );
  }

  if (!siteConfig.includes(`"backgroundClass": "${expectedClass}"`)) {
    throw new Error(`siteConfig missing backgroundClass ${expectedClass}`);
  }

  assertExactSectionBackgroundInSiteConfig(siteConfig, sectionIndex, {
    type: sectionType,
    title,
    backgroundClass: expectedClass,
  });

  if (pipeline.summary.toLowerCase().includes(scenario.color.toLowerCase()) &&
      !pipeline.summary.includes(expectedClass)) {
    throw new Error(
      `Summary must cite exact Tailwind class ${expectedClass}, not only color word "${scenario.color}": ${pipeline.summary}`
    );
  }

  if (!sectionRendererUsesPresentationResolver(page, component)) {
    throw new Error(`${component} must use resolveSectionBackground after edit`);
  }

  if (!pipeline.summary.includes(expectedClass)) {
    throw new Error(`Summary must cite exact class: ${pipeline.summary}`);
  }

  if (!pipeline.summary.includes(title)) {
    throw new Error(`Summary must cite section title: ${pipeline.summary}`);
  }

  for (const rel of scenario.expectFiles?.mustInclude ?? []) {
    if (!pipeline.changedFiles.includes(rel)) {
      throw new Error(`Expected changed file ${rel}, got ${pipeline.changedFiles.join(', ')}`);
    }
  }

  for (const rel of scenario.expectFiles?.mustExclude ?? []) {
    if (pipeline.changedFiles.includes(rel)) {
      throw new Error(`Unexpected changed file ${rel} for scenario "${scenario.name}"`);
    }
  }
}

export async function withSectionColorContract(
  scenario: SectionColorEditScenario,
  assertFn: (result: SectionColorEditContractResult) => void | Promise<void>
): Promise<void> {
  const result = await runSectionColorEditContract(scenario);
  try {
    await assertFn(result);
  } finally {
    await destroySyntheticWorkspace(result.workspacePath);
  }
}

/** Built-in generic scenarios (website-agnostic). */
export const GENERIC_SECTION_COLOR_SCENARIOS: SectionColorEditScenario[] = [
  ...(['services', 'about', 'gallery', 'testimonials', 'faq', 'contact', 'generic'] as const).flatMap(
    (sectionType) => [
      {
        name: `${sectionType}: infra ready + wired page`,
        sectionType,
        color: 'red',
        pageMode: 'wired' as const,
        infraBaselineReady: true,
        expectFiles: { mustInclude: ['src/lib/siteConfig.ts'], mustExclude: ['tailwind.config.js'] },
      },
      {
        name: `${sectionType}: infra ready + legacy page wires target only`,
        sectionType,
        color: 'red',
        pageMode: 'legacy' as const,
        infraBaselineReady: true,
        expectFiles: { mustInclude: ['src/lib/siteConfig.ts', 'src/app/page.tsx'] },
      },
      {
        name: `${sectionType}: legacy infra full repair`,
        sectionType,
        color: 'red',
        pageMode: 'legacy' as const,
        infraBaselineReady: false,
        tailwind: 'minimal' as const,
        expectFiles: {
          mustInclude: ['src/lib/siteConfig.ts', 'src/app/page.tsx', 'tailwind.config.js'],
        },
      },
    ]
  ),
  {
    name: 'ordinal: last section (contact in multi-section site)',
    sectionType: 'contact',
    sectionIndex: 0,
    color: 'red',
    ownerMessage: 'change background color of the last section to red',
    pageMode: 'legacy',
    infraBaselineReady: true,
    expectFiles: { mustInclude: ['src/lib/siteConfig.ts', 'src/app/page.tsx'] },
  },
  {
    name: 'flat color: black on last section (legacy contact)',
    sectionType: 'contact',
    sectionIndex: 0,
    color: 'black',
    ownerMessage: 'change background color of the last section to black',
    pageMode: 'legacy',
    infraBaselineReady: true,
    expectFiles: { mustInclude: ['src/lib/siteConfig.ts', 'src/app/page.tsx'] },
  },
  {
    name: 'flat color: white on gallery (wired)',
    sectionType: 'gallery',
    color: 'white',
    pageMode: 'wired',
    infraBaselineReady: true,
  },
];

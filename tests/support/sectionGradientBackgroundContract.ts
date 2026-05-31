/**
 * Shared contract for section background gradient edits (quoted titles, color gradient phrasing).
 */

import { expect } from 'vitest';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  type PageRendererMode,
  type SyntheticSiteSpec,
} from './syntheticSiteWorkspace';
import { confusingTitlesSiteSpec } from './hardCatalogSiteSpecs';

function parseSections(siteConfig: string): Array<Record<string, unknown>> {
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

function sectionBackgroundClass(section: Record<string, unknown>): string | undefined {
  const presentation = section.presentation as Record<string, unknown> | undefined;
  return typeof presentation?.backgroundClass === 'string'
    ? presentation.backgroundClass
    : undefined;
}

export type GradientAgentRunner = (input: {
  workspacePath: string;
  ownerMessage: string;
  projectId: string;
}) => Promise<WebsiteEditAgentResult>;

export type SectionGradientScenario = {
  id: string;
  site: SyntheticSiteSpec;
  pageMode: PageRendererMode;
  targetIndex: number;
  targetType: string;
  targetTitle: string;
  ownerMessage: string;
  /** Section indices that must not receive the target gradient class. */
  unchangedIndices?: number[];
  /** When set, strategy must match (e.g. section_style). */
  expectStrategy?: string;
};

export const SECTION_GRADIENT_LLM_SCENARIOS: SectionGradientScenario[] = [
  {
    id: 'get-started-quoted-before-background',
    site: {
      sections: [
        { type: 'services', title: 'Our Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'legacy',
    targetIndex: 1,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage: 'change this section "Get Started Today" background to color gradient',
    unchangedIndices: [0],
  },
  {
    id: 'get-started-wired-page',
    site: {
      sections: [
        { type: 'services', title: 'Our Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 1,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage: 'change this section "Get Started Today" background to color gradient',
    unchangedIndices: [0],
  },
  {
    id: 'trusted-by-testimonials',
    site: {
      sections: [
        { type: 'testimonials', title: 'Trusted by Over 400,000 Service Professionals' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 0,
    targetType: 'testimonials',
    targetTitle: 'Trusted by Over 400,000 Service Professionals',
    ownerMessage:
      'change this section "Trusted by Over 400,000 Service Professionals" background to color gradient',
    unchangedIndices: [1],
  },
  {
    id: 'grow-business-deictic-after-to',
    site: confusingTitlesSiteSpec(),
    pageMode: 'wired',
    targetIndex: 0,
    targetType: 'services',
    targetTitle: 'Everything You Need to Grow Your Business',
    ownerMessage:
      'change this section background to color gradient "Everything You Need to Grow Your Business"',
    unchangedIndices: [4],
  },
  {
    id: 'get-started-black-white-gradient',
    site: {
      sections: [
        { type: 'services', title: 'Our Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 1,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage:
      'change this section "Get Started Today" background to black and white color gradient',
    unchangedIndices: [0],
  },
  {
    id: 'get-started-back-white-typo-gradient',
    site: {
      sections: [
        { type: 'services', title: 'Our Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'legacy',
    targetIndex: 1,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage:
      'change this section "Get Started Today" background to back and white color gradient',
    unchangedIndices: [0],
  },
  {
    id: 'get-started-blue-gradient-hue',
    site: {
      sections: [
        { type: 'services', title: 'Our Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 1,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage:
      'change this section "Get Started Today" background to a blue color gradient',
    unchangedIndices: [0],
  },
  {
    id: 'testimonials-blue-to-yellow-gradient',
    site: {
      sections: [
        {
          type: 'testimonials',
          title: "let's see what's our cusotmer say",
        },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 0,
    targetType: 'testimonials',
    targetTitle: "let's see what's our cusotmer say",
    ownerMessage:
      'change this background of the section "let\'s see what\'s our cusotmer say" to blue to yellow gradient',
    unchangedIndices: [1],
  },
  {
    id: 'testimonials-blue-to-orange-gradient',
    site: {
      sections: [
        {
          type: 'testimonials',
          title: "let's see what's our cusotmer say",
        },
        { type: 'contact', title: 'Get Started Today' },
      ],
    },
    pageMode: 'wired',
    targetIndex: 0,
    targetType: 'testimonials',
    targetTitle: "let's see what's our cusotmer say",
    ownerMessage:
      'change this background of the section "let\'s see what\'s our cusotmer say" to blue to orange gradient',
    unchangedIndices: [1],
  },
  {
    id: 'contact-colon-title-suffix',
    site: confusingTitlesSiteSpec(),
    pageMode: 'wired',
    targetIndex: 4,
    targetType: 'contact',
    targetTitle: 'Get Started Today',
    ownerMessage:
      'change the background color of this to color gradient: Get Started Today',
    unchangedIndices: [0],
  },
];

export type GradientContractRun = {
  scenario: SectionGradientScenario;
  workspacePath: string;
  result: WebsiteEditAgentResult;
  siteConfig: string;
};

/** Run one gradient scenario end-to-end through an agent runner. */
export async function runSectionGradientScenario(
  scenario: SectionGradientScenario,
  runAgent: GradientAgentRunner,
  agentLabel: string
): Promise<GradientContractRun> {
  const workspacePath = await createSyntheticWorkspace({
    site: scenario.site,
    pageMode: scenario.pageMode,
    tailwind: 'canonical',
  });

  const result = await runAgent({
    workspacePath,
    ownerMessage: scenario.ownerMessage,
    projectId: `llm-gradient-${agentLabel}-${scenario.id}`,
  });

  const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
  return { scenario, workspacePath, result, siteConfig };
}

/** Assert invariants for a successful gradient background edit. */
export function assertSectionGradientContract(run: GradientContractRun): void {
  const { scenario, result, siteConfig } = run;
  const detail = result.error ?? result.ownerMessage ?? result.summary ?? '';

  expect(result.needsClarification, detail).toBeFalsy();
  expect(result.ok, detail).toBe(true);

  if (scenario.expectStrategy) {
    expect(result.strategy, detail).toBe(scenario.expectStrategy);
  }

  expect(result.summary ?? '', detail).toMatch(/gradient/i);
  expect(result.summary ?? '', detail).not.toMatch(/\bbg-black\b/i);
  expect(result.summary ?? '', detail).toMatch(new RegExp(escapeRegExp(scenario.targetTitle), 'i'));

  const expectedClass =
    extractSectionBackgroundClassFromMessage(scenario.ownerMessage) ?? '';
  expect(expectedClass, detail).toMatch(/gradient/);

  const sections = parseSections(siteConfig);
  const targetBg = sectionBackgroundClass(sections[scenario.targetIndex] ?? {}) ?? '';
  expect(targetBg, detail).toMatch(/gradient/);
  expect(targetBg, detail).not.toBe('bg-black');

  if (expectedClass) {
    expect(targetBg, detail).toBe(expectedClass);
  }

  for (const index of scenario.unchangedIndices ?? []) {
    const otherBg = sectionBackgroundClass(sections[index] ?? {}) ?? '';
    if (otherBg && targetBg) {
      expect(otherBg, `section ${index} must not match target gradient`).not.toBe(targetBg);
    }
  }
}

export async function withSectionGradientScenario(
  scenario: SectionGradientScenario,
  runAgent: GradientAgentRunner,
  agentLabel: string,
  assertFn: (run: GradientContractRun) => void | Promise<void>
): Promise<void> {
  const run = await runSectionGradientScenario(scenario, runAgent, agentLabel);
  try {
    await assertFn(run);
  } finally {
    await destroySyntheticWorkspace(run.workspacePath);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shared helpers for live LLM edit-agent integration tests.
 *
 * Assertion policy:
 * - `mustClarify` — hard fail if edit succeeds or siteConfig changes
 * - `mustSucceed` — hard fail on needsClarification (no early-return escape hatch)
 */
import { expect } from 'vitest';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  readSyntheticFile,
  type SyntheticSiteSpec,
} from './syntheticSiteWorkspace';

export type LlmEditExpect = 'clarify' | 'success';

export type LlmEditScenario = {
  name: string;
  siteSpec?: SyntheticSiteSpec;
  message: string;
  history?: ConversationTurn[];
  expect: LlmEditExpect;
  sectionTargetLlm?: boolean;
  assert?: (args: {
    result: WebsiteEditAgentResult;
    siteConfigBefore: string;
    siteConfigAfter: string;
    workspacePath: string;
  }) => void | Promise<void>;
};

export function assertSiteConfigUnchanged(before: string, after: string): void {
  expect(after, 'siteConfig must not change on clarify').toBe(before);
}

/** Hard fail unless the agent asks for clarification. */
export function mustClarify(result: WebsiteEditAgentResult): void {
  expect(result.needsClarification, result.error ?? result.summary).toBe(true);
  expect(result.ok, 'ok should be false when clarifying').toBe(false);
}

/** Hard fail on clarification — use when success is required. */
export function mustSucceed(result: WebsiteEditAgentResult, hint?: string): void {
  const detail = hint ?? result.error ?? result.ownerMessage ?? result.summary ?? '';
  expect(result.needsClarification, detail).toBeFalsy();
  expect(result.ok, detail).toBe(true);
}

function parseSiteConfig(content: string): Record<string, unknown> {
  const literal = extractSiteConfigObjectLiteral(content);
  if (!literal) return {};
  try {
    return new Function(`return (${literal})`)() as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function assertFieldsEqual(
  siteConfigContent: string,
  expected: {
    businessName?: string;
    heroHeadline?: string;
    sectionIndex?: number;
    sectionTitle?: string;
    backgroundClass?: string;
  }
): void {
  const config = parseSiteConfig(siteConfigContent);
  if (expected.businessName !== undefined) {
    expect(config.businessName).toBe(expected.businessName);
  }
  const hero = config.hero as { headline?: string } | undefined;
  if (expected.heroHeadline !== undefined) {
    expect(hero?.headline).toBe(expected.heroHeadline);
  }
  if (expected.sectionIndex !== undefined && expected.backgroundClass !== undefined) {
    const sections = config.sections as Array<Record<string, unknown>> | undefined;
    const section = sections?.[expected.sectionIndex];
    const presentation = section?.presentation as { backgroundClass?: string } | undefined;
    expect(presentation?.backgroundClass).toBe(expected.backgroundClass);
    if (expected.sectionTitle !== undefined) {
      expect(section?.title).toBe(expected.sectionTitle);
    }
  }
}

/** Summary should cite the saved Tailwind class and section title from siteConfig. */
export function assertSummaryMatchesSiteConfig(
  result: WebsiteEditAgentResult,
  siteConfigContent: string,
  sectionIndex: number
): void {
  const config = parseSiteConfig(siteConfigContent);
  const sections = config.sections as Array<Record<string, unknown>> | undefined;
  const section = sections?.[sectionIndex];
  const presentation = section?.presentation as { backgroundClass?: string } | undefined;
  const bgClass = presentation?.backgroundClass;
  if (typeof bgClass === 'string' && bgClass.length > 0) {
    if (/gradient/i.test(bgClass)) {
      expect(result.summary ?? '', 'summary must describe gradient').toMatch(/gradient/i);
    } else {
      expect(result.summary ?? '', 'summary must cite saved backgroundClass').toContain(bgClass);
    }
  }
  const title = section?.title;
  if (typeof title === 'string') {
    expect(result.summary ?? '', 'summary must name the edited section').toContain(title);
  }
}

/**
 * Run a V3 edit scenario with workspace setup. Caller owns destroy via afterEach.
 */
export async function runV3LlmScenario(scenario: LlmEditScenario): Promise<{
  result: WebsiteEditAgentResult;
  siteConfigBefore: string;
  siteConfigAfter: string;
  workspacePath: string;
}> {
  const prevSectionTargetLlm = process.env.SECTION_TARGET_LLM;
  if (scenario.sectionTargetLlm) {
    process.env.SECTION_TARGET_LLM = '1';
  }

  const siteSpec = scenario.siteSpec ?? defaultMultiSectionSiteSpec();
  const workspacePath = await createSyntheticWorkspace({
    site: siteSpec,
    pageMode: 'wired',
    tailwind: 'canonical',
  });

  try {
    const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: scenario.message,
      conversationHistory: scenario.history,
      projectId: `llm-scenario-${scenario.name.replace(/\s+/g, '-').slice(0, 40)}`,
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

    if (scenario.expect === 'clarify') {
      mustClarify(result);
      assertSiteConfigUnchanged(siteConfigBefore, siteConfigAfter);
    } else {
      mustSucceed(result);
    }

    if (scenario.assert) {
      await scenario.assert({
        result,
        siteConfigBefore,
        siteConfigAfter,
        workspacePath,
      });
    }

    return { result, siteConfigBefore, siteConfigAfter, workspacePath };
  } finally {
    if (prevSectionTargetLlm === undefined) {
      delete process.env.SECTION_TARGET_LLM;
    } else {
      process.env.SECTION_TARGET_LLM = prevSectionTargetLlm;
    }
  }
}

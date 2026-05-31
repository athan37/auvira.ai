/**
 * Generic LLM contract: section background edit on a synthetic multi-section site (V3).
 *
 * Run: npm run test:llm:contracts
 */
import '../../llmTestGate';
import { afterEach, expect, it, vi } from 'vitest';
import { describeRunLlmIntegration } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { SITECONFIG_PRESENTATION_SYNC_EXPORT } from '@/lib/site-manager/siteConfigAgentMarkers';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import { assertExactSectionBackgroundInSiteConfig } from '../../support/sectionColorEditContract';
import { mustSucceed } from '../../support/llmEditScenario';

type LlmColorScenario = {
  name: string;
  sectionIndex: number;
  color: string;
  buildMessage: (title: string, index: number, total: number) => string;
};

const LLM_COLOR_SCENARIOS: LlmColorScenario[] = [
  {
    name: 'named section background',
    sectionIndex: 2,
    color: 'yellow',
    buildMessage: (title) => `Change the "${title}" section background to yellow`,
  },
  {
    name: 'first section ordinal',
    sectionIndex: 0,
    color: 'blue',
    buildMessage: () => 'Change the background of the first section to blue',
  },
  {
    name: 'last section ordinal',
    sectionIndex: -1,
    color: 'red',
    buildMessage: (_title, _index, total) =>
      'change background color of the last section to red',
  },
];

describeRunLlmIntegration('agent contracts: section color (generic LLM, V3)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it.each(LLM_COLOR_SCENARIOS.map((s) => [s.name, s] as const))(
    '%s on synthetic site',
    async (_name, scenario) => {
      const siteSpec = defaultMultiSectionSiteSpec();
      const total = siteSpec.sections.length;
      const sectionIndex =
        scenario.sectionIndex < 0 ? total + scenario.sectionIndex : scenario.sectionIndex;
      const section = siteSpec.sections[sectionIndex];
      const title = section.title ?? `Section ${sectionIndex + 1}`;

      workspacePath = await createSyntheticWorkspace({
        site: siteSpec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const ownerMessage = scenario.buildMessage(title, sectionIndex, total);
      const expectedClass = colorNameToBackgroundClass(scenario.color, ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'synthetic-llm-contract-v3',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result, result.error ?? result.summary);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

      assertExactSectionBackgroundInSiteConfig(siteConfig, sectionIndex, {
        type: String(section.type),
        title,
        backgroundClass: expectedClass,
      });
      expect(siteConfig).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
      expect(result.summary ?? '').toContain(expectedClass);
    },
    120_000
  );
});

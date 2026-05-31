/**
 * Live LLM: summary / ownerMessage accuracy vs saved siteConfig.
 *
 * Run: npm run test:llm
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import {
  assertSummaryMatchesSiteConfig,
  mustSucceed,
} from '../support/llmEditScenario';
import {
  assertV3EditSucceeded,
  assertV3SectionBackgroundEdit,
  confusingTitlesSiteSpec,
  parseSections,
  sectionBackgroundClass,
} from './editHarness';

describeRunLlmIntegration('edit-agent report accuracy (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'summary cites exact saved Tailwind class for named gallery section',
    async () => {
      const siteSpec = defaultMultiSectionSiteSpec();
      const galleryIndex = siteSpec.sections.findIndex((s) => s.type === 'gallery');
      const galleryTitle = siteSpec.sections[galleryIndex].title!;
      const ownerMessage = `Change the "${galleryTitle}" section background to yellow`;

      workspacePath = await createSyntheticWorkspace({
        site: siteSpec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'llm-report-gallery-yellow',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const expectedClass = colorNameToBackgroundClass('yellow', ownerMessage);
      expect(result.summary).toContain(expectedClass);
      assertSummaryMatchesSiteConfig(result, siteConfig, galleryIndex);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'gradient on grow-business: summary must not name unrelated Get Started Today',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const targetTitle = spec.sections[0].title!;
      const ownerMessage = `change this section background to color gradient "${targetTitle}"`;

      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'llm-report-gradient-grow',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      assertV3EditSucceeded(result);
      expect(result.summary).toMatch(/gradient/i);
      expect(result.summary).not.toMatch(/Get Started Today/i);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      expect(sectionBackgroundClass(sections[0] ?? {})).toMatch(/gradient/);
      expect(sectionBackgroundClass(sections[4] ?? {}) ?? '').not.toMatch(/gradient/);
      assertSummaryMatchesSiteConfig(result, siteConfig, 0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'paraphrase testimonials purple: summary and siteConfig agree on section',
    async () => {
      process.env.SECTION_TARGET_LLM = '1';
      const spec = confusingTitlesSiteSpec();
      const testimonialsIndex = 3;
      const testimonialsTitle = spec.sections[testimonialsIndex].title!;
      const ownerMessage =
        'Make the section where customers talk about growth have a purple background';

      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'llm-report-paraphrase-purple',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      assertV3EditSucceeded(result);
      expect(result.summary).toMatch(/purple|Customers Say|Growth/i);

      await assertV3SectionBackgroundEdit(workspacePath, {
        targetIndex: testimonialsIndex,
        targetType: 'testimonials',
        targetTitle: testimonialsTitle,
        ownerMessage,
        color: 'purple',
        colorFamily: true,
        unchangedIndices: [0, 4],
      });

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertSummaryMatchesSiteConfig(result, siteConfig, testimonialsIndex);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

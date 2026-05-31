/**
 * LLM smoke: UI-selected section target pins style edits without clarification.
 *
 * Run: npm run test:llm -- tests/integration/edit-agent/selectedTarget.llm.test.ts
 */
import '../../llmTestGate';
import { afterEach, describe, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import { parseSections, sectionBackgroundClass } from '../../edit-agent/editHarness';

describeRunLlmIntegration('selectedTarget (LLM smoke)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'make it red with contact section selected applies to contact index',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Services' },
            { type: 'contact', title: 'Contact Us' },
            { type: 'about', title: 'About' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const contactIdMatch = siteConfigBefore.match(/"analyticsId"\s*:\s*"([^"]+)"/g);
      const analyticsIds =
        contactIdMatch?.map((m) => m.match(/"([^"]+)"\s*$/)?.[1]).filter(Boolean) ?? [];
      const contactAnalyticsId = analyticsIds[1] ?? analyticsIds[analyticsIds.length - 1];

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'make it red',
        projectId: 'llm-selected-target-contact',
        mode: 'gitlab',
        infraBaselineReady: true,
        selectedTarget: {
          kind: 'section',
          sectionId: contactAnalyticsId,
          analyticsId: contactAnalyticsId,
          sectionIndex: 1,
          sectionType: 'contact',
          sectionTitle: 'Contact Us',
        },
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const contactBg = sectionBackgroundClass(sections[1] ?? {});
      expect(contactBg).toBeDefined();
      expect(contactBg!.toLowerCase()).toMatch(/red/);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

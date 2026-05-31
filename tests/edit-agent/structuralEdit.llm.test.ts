/**
 * Live LLM: structural section edits (remove / reorder).
 *
 * Run: npm run test:llm:edit-errors
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { mustSucceed } from '../support/llmEditScenario';
import { confusingTitlesSiteSpec, parseSections } from './editHarness';

describeRunLlmIntegration('edit-agent structural edit (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'remove by name: contact section absent from siteConfig',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Services' },
            { type: 'contact', title: 'Contact' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'Remove the contact section',
        projectId: 'llm-structural-remove',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      expect(siteConfig).toContain('Services');
      expect(siteConfig).not.toMatch(/"title":\s*"Contact"/);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'remove last section on multi-section site',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const lastIndex = spec.sections.length - 1;
      const lastTitle = spec.sections[lastIndex].title!;

      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'delete the last section',
        projectId: 'llm-structural-remove-last',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      expect(sections.length).toBe(spec.sections.length - 1);
      expect(siteConfig).not.toContain(`"${lastTitle}"`);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

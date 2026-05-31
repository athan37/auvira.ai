/**
 * Live LLM: copy edits, duplicate businessName/hero, copy-without-value.
 *
 * Run: npm run test:llm:edit-errors
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import {
  assertFieldsEqual,
  assertSiteConfigUnchanged,
  mustClarify,
  mustSucceed,
} from '../support/llmEditScenario';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

describeRunLlmIntegration('edit-agent copy edit (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'multi-turn: duplicate headline + businessName → both updated',
    async () => {
      const duplicateTitle = "Houston's HVAC All-Stars Are Here to Win Your Comfort";
      const newTitle = 'All-Star HVAC - Houston Premier Team';

      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: duplicateTitle,
          hero: { headline: duplicateTitle, subheadline: 'Comfort experts' },
          sections: [{ type: 'gallery', title: 'Our Products' }],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const turns = history(
        {
          role: 'user',
          content: `change this description "${duplicateTitle}" to hi this is david`,
        },
        {
          role: 'assistant',
          content: `The text '${duplicateTitle}' appears as business name and hero headline. Which to update?`,
        },
        { role: 'user', content: 'Both the business name and hero headline' },
        {
          role: 'assistant',
          content: 'What would you like the new business name and hero headline to be?',
        }
      );

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: newTitle,
        conversationHistory: turns,
        projectId: 'llm-copy-dup-both',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result, result.error ?? result.ownerMessage);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertFieldsEqual(siteConfig, { businessName: newTitle, heroHeadline: newTitle });
      expect(result.summary?.trim().length).toBeGreaterThan(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'unique businessName only: hero headline unchanged',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: 'Only Biz',
          hero: { headline: 'Different Headline', subheadline: 'Sub' },
          sections: [{ type: 'services', title: 'Services' }],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change "Only Biz" to "New Co"',
        projectId: 'llm-copy-biz-only',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertFieldsEqual(siteConfig, {
        businessName: 'New Co',
        heroHeadline: 'Different Headline',
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'hero headline only: businessName unchanged',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: 'Stable Biz Name',
          hero: { headline: 'Old Tagline', subheadline: 'Sub' },
          sections: [{ type: 'services', title: 'Services' }],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change headline to "New Tagline"',
        projectId: 'llm-copy-hero-only',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertFieldsEqual(siteConfig, {
        businessName: 'Stable Biz Name',
        heroHeadline: 'New Tagline',
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'copy without value: clarifies and does not mutate siteConfig',
    async () => {
      const siteSpec = defaultMultiSectionSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: siteSpec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'update the services section text',
        projectId: 'llm-copy-no-value',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustClarify(result);
      expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);

      const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertSiteConfigUnchanged(before, after);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'ambiguous duplicate string: short prompt clarifies without silent single-field write',
    async () => {
      const duplicateTitle = 'Same Title Everywhere';
      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: duplicateTitle,
          hero: { headline: duplicateTitle, subheadline: 'Sub' },
          sections: [{ type: 'services', title: 'Services' }],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: duplicateTitle,
        projectId: 'llm-copy-ambiguous',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (result.ok && !result.needsClarification) {
        const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
        const changedBiz = after.includes('"businessName": "Same Title Everywhere"') === false;
        const changedHero = after.includes('"headline": "Same Title Everywhere"') === false;
        expect(
          changedBiz && changedHero,
          'must not silently update only one field when both match'
        ).toBe(true);
        return;
      }

      mustClarify(result);
      const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertSiteConfigUnchanged(before, after);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'Our Products section title to unquoted value: updates services section title',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: 'Copy Edit Test Site',
          sections: [
            { type: 'services', title: 'Our Products' },
            { type: 'testimonials', title: 'What Our Customers Say' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const ownerMessage = 'change Our Products section title to hello this is david 2';
      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'llm-copy-our-products-title',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result, result.error ?? result.ownerMessage);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      expect(siteConfig).toContain('"title": "hello this is david 2"');
      expect(siteConfig).not.toContain('"title": "Our Products"');
    },
    LLM_TEST_TIMEOUT_MS
  );
});

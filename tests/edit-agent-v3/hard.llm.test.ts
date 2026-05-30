/**
 * Hard V3 scenarios requiring LLM planner or multi-turn resolution.
 *
 * Run: npm run test:llm:edit-agent-v3:hard
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { runWebsiteEditAgentV3 } from '@/lib/project-workspace/edit-agent-v3';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/types';
import {
  assertV3EditSucceeded,
  assertV3SectionBackgroundEdit,
  confusingTitlesSiteSpec,
} from './v3HardHarness';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

function buildCatalogClarification(catalog: ReturnType<typeof buildSiteSectionCatalog>): string {
  return (
    'Which section do you mean? Reply with the number:\n\n' +
    catalog.sections
      .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
      .join('\n')
  );
}

describeRunLlmIntegration('edit-agent-v3 hard (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'planner paraphrase: customers talk about growth → testimonials (V3 catalog LLM)',
    async () => {
      process.env.SECTION_TARGET_LLM = '1';
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage:
          'Make the section where customers talk about growth have a purple background',
        infraBaselineReady: true,
      });

      const planResult = await planEdit({
        editContext: ctx.context,
        userPrompt:
          'Make the section where customers talk about growth have a purple background',
      });

      expect(planResult.ok, planResult.error).toBe(true);
      expect(planResult.plan?.needsClarification, JSON.stringify(planResult.plan)).not.toBe(true);

      const styleStep = planResult.plan?.steps.find((s) => s.skill === 'update_section_style');
      expect(styleStep, JSON.stringify(planResult.plan?.steps)).toBeTruthy();
      expect(styleStep?.target?.sectionIndex ?? styleStep?.params?.sectionIndex).toBe(3);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'multi-turn: vague deictic clarifies then numbered reply applies gallery section',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const siteConfigContent = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const pageContent = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
      const galleryIndex = 2;
      const galleryTitle = spec.sections[galleryIndex].title!;

      const turns = history(
        { role: 'user', content: 'Change the background color of this section to green' },
        { role: 'assistant', content: buildCatalogClarification(catalog) }
      );

      const result = await runWebsiteEditAgentV3({
        workspacePath,
        ownerMessage: `3 — ${galleryTitle}`,
        conversationHistory: turns,
        projectId: 'v3-hard-numbered-reply',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (result.needsClarification) {
        expect(result.ownerMessage).toMatch(
          new RegExp(galleryTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        );
        return;
      }

      assertV3EditSucceeded(result);

      await assertV3SectionBackgroundEdit(workspacePath, {
        targetIndex: galleryIndex,
        targetType: 'gallery',
        targetTitle: galleryTitle,
        ownerMessage: turns[0].content,
        color: 'green',
        unchangedIndices: [0, 4],
      });

      const expectedClass = colorNameToBackgroundClass('green', turns[0].content);
      expect(result.summary).toContain(expectedClass);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'recency override: owner revises target section mid-thread',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const contactTitle = spec.sections[4].title!;

      const turns = history(
        { role: 'user', content: `Change "${contactTitle}" background to yellow` },
        { role: 'assistant', content: `Updated "${contactTitle}" background to yellow.` },
        {
          role: 'user',
          content: `Sorry, I meant "${growTitle}" — make that one yellow instead`,
        }
      );

      const result = await runWebsiteEditAgentV3({
        workspacePath,
        ownerMessage: turns[2].content,
        conversationHistory: turns.slice(0, 2),
        projectId: 'v3-hard-recency',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      assertV3EditSucceeded(result);

      await assertV3SectionBackgroundEdit(workspacePath, {
        targetIndex: 0,
        targetType: 'services',
        targetTitle: growTitle,
        ownerMessage: turns[2].content,
        color: 'yellow',
        colorFamily: true,
        unchangedIndices: [4],
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'strict E2E: overlapping titles + exact Tailwind class in summary and siteConfig',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const targetTitle = spec.sections[0].title!;
      const ownerMessage = `change this section background to blue "${targetTitle}"`;
      const expectedClass = colorNameToBackgroundClass('blue', ownerMessage);

      const result = await runWebsiteEditAgentV3({
        workspacePath,
        ownerMessage,
        projectId: 'v3-hard-llm-strict-blue',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      assertV3EditSucceeded(result);
      expect(result.summary).toContain(expectedClass);
      expect(result.summary).toContain(targetTitle);

      await assertV3SectionBackgroundEdit(workspacePath, {
        targetIndex: 0,
        targetType: 'services',
        targetTitle,
        ownerMessage,
        unchangedIndices: [4],
      });
    },
    LLM_TEST_TIMEOUT_MS
  );
});

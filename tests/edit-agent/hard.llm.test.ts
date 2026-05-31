/**
 * Hard V3 scenarios requiring LLM planner or multi-turn resolution.
 *
 * Run: npm run test:llm:edit-agent:hard
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { planWithLiveLlm, styleStepSectionIndex } from '../support/planWithLiveLlm';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import {
  assertSiteConfigUnchanged,
  assertV3EditSucceeded,
  assertV3SectionBackgroundEdit,
  confusingTitlesSiteSpec,
  parseSections,
  sectionBackgroundClass,
} from './editHarness';

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

describeRunLlmIntegration('edit-agent hard (LLM)', () => {
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

      const result = await runWebsiteEditAgent({
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

      const result = await runWebsiteEditAgent({
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

      const result = await runWebsiteEditAgent({
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

  it(
    'deictic-only on confusing site: clarifies without mutating siteConfig',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change this section background to red',
        projectId: 'v3-hard-llm-deictic-immutable',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification).toBe(true);
      expect(result.ok).toBe(false);
      expect(result.ownerMessage).toMatch(/which section/i);

      const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertSiteConfigUnchanged(before, after);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'multi-turn V3: wrong numbered pick then correction applies grow-business section',
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
      const growIndex = 0;
      const growTitle = spec.sections[growIndex].title!;

      const turns = history(
        { role: 'user', content: 'Change the background color of this section to orange' },
        { role: 'assistant', content: buildCatalogClarification(catalog) },
        { role: 'user', content: '5' },
        {
          role: 'assistant',
          content: `Updated "${spec.sections[4].title}" background to orange.`,
        }
      );

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: '1',
        conversationHistory: turns,
        projectId: 'v3-hard-wrong-then-correct',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      assertV3EditSucceeded(result);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const appliedClass = sectionBackgroundClass(sections[growIndex] ?? {});
      expect(appliedClass).toMatch(/^bg-orange-\d{3}$/);
      expect(String(sections[growIndex]?.type)).toBe('services');
      expect(String(sections[growIndex]?.title)).toBe(growTitle);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'fuzzy trap: section titled business must not hit Grow Your Business index 0',
    async () => {
      const spec = confusingTitlesSiteSpec();

      const plan = await planWithLiveLlm(
        'change background of section titled business to yellow',
        spec
      );

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
      const idx = styleStepSectionIndex(styleStep);
      expect(idx, 'planner must not target Grow Your Business at index 0').not.toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'hero vs first section: change the top background to blue clarifies',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change the top background to blue',
        projectId: 'v3-hard-hero-vs-first',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (result.ok && !result.needsClarification) {
        const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
        const sections = parseSections(after);
        const blueSections = sections.filter((s) =>
          (sectionBackgroundClass(s) ?? '').includes('blue')
        );
        expect(blueSections.length, 'at most one section should receive blue').toBeLessThanOrEqual(1);
        return;
      }

      expect(result.needsClarification).toBe(true);
      const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertSiteConfigUnchanged(before, after);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

/**
 * Hard section-catalog scenarios: paraphrase targeting, V3 planner, LLM catalog picker.
 *
 * Run: npm run test:llm:section-catalog
 */
import '../../llmTestGate';
import { afterEach, expect, it, vi } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import {
  buildSiteSectionCatalog,
  matchSectionFromMessage,
} from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { resolveSectionWithCatalogLLM } from '@/lib/project-workspace/edit-shared/resolveSectionWithCatalogLLM';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import {
  confusingTitlesSiteSpec,
  similarVerbSiteSpec,
} from '../../support/hardCatalogSiteSpecs';
import {
  planWithLiveLlm,
  styleStepBackgroundHint,
  styleStepSectionIndex,
} from '../../support/planWithLiveLlm';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

describeRunLlmIntegration('section catalog hard scenarios (LLM integration)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'catalog matcher rejects single-word overlap between similar titles',
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

      const match = matchSectionFromMessage(
        'change background of section titled business to yellow',
        catalog
      );

      expect(match?.sectionIndex).not.toBe(0);
      expect(match?.confidence === 'low' || match?.sectionIndex == null).toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'V3 planner: paraphrase "customers say about growth" picks testimonials not services',
    async () => {
      const spec = confusingTitlesSiteSpec();

      const plan = await planWithLiveLlm(
        'Make the section where customers talk about growth have a purple background',
        spec
      );

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
      expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
      expect(styleStepSectionIndex(styleStep)).toBe(3);
      expect(styleStepBackgroundHint(styleStep)).toMatch(/purple/i);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'V3 planner: recency override when owner revises target section mid-thread',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const growTitle = spec.sections[0].title!;
      const contactTitle = spec.sections[4].title!;

      const turns = history(
        {
          role: 'user',
          content: `Change "${contactTitle}" background to yellow`,
        },
        { role: 'assistant', content: `Updated "${contactTitle}" background to yellow.` },
        {
          role: 'user',
          content: `Sorry, I meant "${growTitle}" — make that one yellow instead`,
        }
      );

      const plan = await planWithLiveLlm(turns[2].content, spec, turns);

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
      expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
      expect(styleStepSectionIndex(styleStep)).toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'LLM catalog picker: ambiguous paraphrase selects gallery (SECTION_TARGET_LLM=1)',
    async () => {
      vi.stubEnv('SECTION_TARGET_LLM', '1');

      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const siteConfigContent = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const pageContent = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);

      const pick = await resolveSectionWithCatalogLLM(
        'change background of the section that shows our portfolio photos to orange',
        catalog
      );

      expect(pick, 'LLM picker returned null — check GEMINI_API_KEY and SECTION_TARGET_LLM').not.toBeNull();
      expect(pick!.sectionIndex).toBe(2);
      expect(['high', 'medium']).toContain(pick!.confidence);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'LLM catalog picker: disambiguates two "Everything You Need" titles',
    async () => {
      vi.stubEnv('SECTION_TARGET_LLM', '1');

      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const siteConfigContent = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const pageContent = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);

      const pick = await resolveSectionWithCatalogLLM(
        'section index 1 — about type — title "Everything You Need to Know About Us" — change background to teal',
        catalog
      );

      expect(pick).not.toBeNull();
      expect(pick!.sectionIndex).toBe(1);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'V3 planner: hero vs first section color targets first content section when named',
    async () => {
      const spec = confusingTitlesSiteSpec();

      const plan = await planWithLiveLlm(
        'Change the first content section (not the hero) background to teal — the one titled Everything You Need to Grow Your Business',
        spec
      );

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
      expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
      expect(styleStepSectionIndex(styleStep)).toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'V3 planner: card color vs section background — whole section after scope clarification',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const testimonialsTitle = spec.sections[3].title!;

      const styleScopeClarification =
        'This sounds like a color or style change, not new section content — can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?';

      const turns = history(
        { role: 'user', content: `Make ${testimonialsTitle} red` },
        { role: 'assistant', content: styleScopeClarification }
      );

      const plan = await planWithLiveLlm('whole section background', spec, turns);

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((step) => step.skill === 'update_section_style');
      expect(styleStep, JSON.stringify(plan.steps)).toBeTruthy();
      expect(styleStepSectionIndex(styleStep)).toBe(3);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'LLM catalog picker: disambiguates Get Started vs Getting Started',
    async () => {
      vi.stubEnv('SECTION_TARGET_LLM', '1');

      const spec = similarVerbSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const siteConfigContent = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const pageContent = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);

      const pick = await resolveSectionWithCatalogLLM(
        'change the background of the contact section called Getting Started Today to yellow',
        catalog
      );

      expect(pick).not.toBeNull();
      expect(pick!.sectionIndex).toBe(2);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

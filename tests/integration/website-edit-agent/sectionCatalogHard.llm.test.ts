/**
 * Hard section-catalog scenarios: similar titles, deictic phrasing, multi-turn
 * clarification, paraphrase targeting, and optional LLM catalog picker.
 *
 * Run: npm run test:llm:section-catalog
 */
import '../../llmTestGate';
import { afterEach, expect, it, vi } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/website-edit-agent';
import {
  colorNameToBackgroundClass,
  extractSectionBackgroundClassFromMessage,
} from '@/lib/builder/sectionPresentation';
import { extractSiteConfigObjectLiteral } from '@/lib/site-manager/siteConfigParser';
import {
  buildSiteSectionCatalog,
  matchSectionFromMessage,
} from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';
import { resolveSectionWithCatalogLLM } from '@/lib/project-workspace/website-edit-agent/resolveSectionWithCatalogLLM';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import {
  confusingTitlesSiteSpec,
  similarVerbSiteSpec,
} from '../../support/hardCatalogSiteSpecs';
import { assertExactSectionBackgroundInSiteConfig } from '../../support/sectionColorEditContract';
import {
  planWithLiveLlm,
  styleStepBackgroundHint,
  styleStepSectionIndex,
} from '../../support/planWithLiveLlm';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/types';

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
    'deterministic: deictic + quoted long title targets services, not contact',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const targetIndex = 0;
      const targetTitle = spec.sections[targetIndex].title!;
      const ownerMessage = `change this section background to blue "${targetTitle}"`;
      const expectedClass = colorNameToBackgroundClass('blue', ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-deictic-quote',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);
      expect(result.strategy).toBe('section_style');

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, targetIndex, {
        type: 'services',
        title: targetTitle,
        backgroundClass: expectedClass,
      });

      const sections = parseSections(siteConfig);
      const contactIndex = 4;
      expect(sectionBackgroundClass(sections[contactIndex] ?? {})).not.toBe(expectedClass);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: colon suffix title resolves grow-business section',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const targetTitle = spec.sections[0].title!;
      const ownerMessage = `change the background color of this to red: ${targetTitle}`;
      const expectedClass = colorNameToBackgroundClass('red', ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-colon-title',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
        type: 'services',
        title: targetTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'multi-turn: vague deictic asks catalog clarification then numbered reply applies correct section',
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
        projectId: 'hard-catalog-numbered-reply',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (result.needsClarification) {
        expect(result.ownerMessage).toMatch(new RegExp(galleryTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        return;
      }

      expect(result.ok, result.error ?? result.summary).toBe(true);
      const expectedClass = colorNameToBackgroundClass('green', turns[0].content);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, galleryIndex, {
        type: 'gallery',
        title: galleryTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

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

      expect(pick, 'LLM picker returned null — check MINIMAX_API_KEY and SECTION_TARGET_LLM').not.toBeNull();
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
    'V1 agent: similar titles trap — quoted grow-business wins over contact on blue edit',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const contactTitle = spec.sections[4].title!;
      const ownerMessage = `change this section background to blue "${growTitle}"`;
      const expectedClass = colorNameToBackgroundClass('blue', ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-similar-trap',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
        type: 'services',
        title: growTitle,
        backgroundClass: expectedClass,
      });

      const sections = parseSections(siteConfig);
      expect(sectionBackgroundClass(sections[4] ?? {})).not.toBe(expectedClass);
      expect(String(sections[4]?.title)).toBe(contactTitle);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'regression: color gradient + quoted grow title targets services not contact',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const ownerMessage = `change this section background to color gradient "${growTitle}"`;

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-gradient-quote',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (!result.ok && result.needsClarification) {
        expect(result.ownerMessage).toMatch(/which section|color|gradient/i);
        return;
      }

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const contactBg = sectionBackgroundClass(sections[4] ?? {});
      const servicesBg = sectionBackgroundClass(sections[0] ?? {});
      if (servicesBg) {
        assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
          type: 'services',
          title: growTitle,
          backgroundClass: servicesBg,
        });
        expect(contactBg).not.toBe(servicesBg);
      }
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: unquoted title suffix at end targets grow-business section',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const ownerMessage = `change this section background to blue ${growTitle}`;
      const expectedClass = colorNameToBackgroundClass('blue', ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-unquoted-suffix',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
        type: 'services',
        title: growTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: color gradient filler + unquoted title suffix',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const ownerMessage = `change this section background to color gradient ${growTitle}`;

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-gradient-unquoted',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      if (result.needsClarification) {
        expect(result.ownerMessage).toMatch(/which section|color/i);
        return;
      }

      expect(result.ok, result.error ?? result.summary).toBe(true);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const servicesBg = sectionBackgroundClass(sections[0] ?? {});
      if (servicesBg) {
        expect(sectionBackgroundClass(sections[4] ?? {})).not.toBe(servicesBg);
      }
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: Get Started vs Getting Started — full title wins',
    async () => {
      const spec = similarVerbSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const contactTitle = spec.sections[2].title!;
      const ownerMessage = `change background of ${contactTitle} to purple`;
      const expectedClass = colorNameToBackgroundClass('purple', ownerMessage);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-getting-started',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, 2, {
        type: 'contact',
        title: contactTitle,
        backgroundClass: expectedClass,
      });

      const sections = parseSections(siteConfig);
      expect(sectionBackgroundClass(sections[0] ?? {})).not.toBe(expectedClass);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: flat black on named section uses bg-black not bg-black-600',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const galleryIndex = 2;
      const galleryTitle = spec.sections[galleryIndex].title!;
      const ownerMessage = `change background of "${galleryTitle}" to black`;
      const expectedClass = colorNameToBackgroundClass('black', ownerMessage);
      expect(expectedClass).toBe('bg-black');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-flat-black',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, galleryIndex, {
        type: 'gallery',
        title: galleryTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: flat white on services section',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const growTitle = spec.sections[0].title!;
      const ownerMessage = `make the background of "${growTitle}" white`;
      const expectedClass = colorNameToBackgroundClass('white', ownerMessage);
      expect(expectedClass).toBe('bg-white');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-flat-white',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
        type: 'services',
        title: growTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deterministic: blue gradient phrasing resolves color and section',
    async () => {
      const spec = confusingTitlesSiteSpec();
      workspacePath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const aboutIndex = 1;
      const aboutTitle = spec.sections[aboutIndex].title!;
      const ownerMessage = `make "${aboutTitle}" a blue gradient background`;
      const expectedClass = extractSectionBackgroundClassFromMessage(ownerMessage)!;
      expect(expectedClass).toMatch(/gradient.*blue/i);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId: 'hard-catalog-blue-gradient',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      assertExactSectionBackgroundInSiteConfig(siteConfig, aboutIndex, {
        type: 'about',
        title: aboutTitle,
        backgroundClass: expectedClass,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'multi-turn: follow-up corrects wrong numbered pick from prior clarification',
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
        projectId: 'hard-catalog-wrong-then-correct',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.summary).toBe(true);

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

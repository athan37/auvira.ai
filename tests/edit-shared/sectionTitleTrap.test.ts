import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { resolveEditTarget, resolveEditTargetAsync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  extractExplicitSectionTitleIntent,
  extractSectionTitleCandidates,
  scoreTitleMatch,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  TRAP_FIXTURE_SUITES,
  assertResolveEditTargetMatchesExpectation,
  assertZeroScoreSectionsNeverHighConfidence,
  expectedExplicitTitleBehavior,
  probeWordsFromTitles,
  quotedTitleStyleMessage,
  sectionTitledStyleMessage,
  strongTitleMatches,
} from '../support/sectionTitleTrapExpectations';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

function mockSiteModel(siteConfig: string, page: string): SiteModel {
  return {
    workspacePath: '/tmp/trap-test',
    mode: 'gitlab',
    archetype: 'section_loop',
    siteConfigPath: 'src/lib/siteConfig.ts',
    pagePath: 'src/app/page.tsx',
    indexHtmlPath: null,
    siteJsonPath: null,
    stylesPath: null,
    siteConfigContent: siteConfig,
    pageContent: page,
    indexHtmlContent: null,
    siteJsonContent: null,
    parsedConfig: null,
    structure: null,
    errors: [],
  };
}

type LoadedFixture = {
  id: string;
  siteConfig: string;
  page: string;
  catalog: ReturnType<typeof buildSiteSectionCatalog>;
  siteModel: SiteModel;
};

async function loadFixture(id: string): Promise<LoadedFixture> {
  const suite = TRAP_FIXTURE_SUITES.find((s) => s.id === id);
  if (!suite) throw new Error(`Unknown fixture ${id}`);

  const workspacePath = await createSyntheticWorkspace({
    site: suite.spec,
    pageMode: 'wired',
    tailwind: 'canonical',
    workspaceId: `section-title-trap-${id}`,
  });
  const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
  const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
  const catalog = buildSiteSectionCatalog(siteConfig, page);
  await destroySyntheticWorkspace(workspacePath);

  return {
    id,
    siteConfig,
    page,
    catalog,
    siteModel: mockSiteModel(siteConfig, page),
  };
}

describe('section title traps', () => {
  const fixtures = new Map<string, LoadedFixture>();

  beforeAll(async () => {
    for (const suite of TRAP_FIXTURE_SUITES) {
      fixtures.set(suite.id, await loadFixture(suite.id));
    }
  });

  for (const suite of TRAP_FIXTURE_SUITES) {
    describe(`fixture: ${suite.id}`, () => {
      describe('substring traps (must clarify)', () => {
        it.each(suite.substringTraps.map((t) => ({ ...t, fixtureId: suite.id })))(
          'clarifies for "$word" (not index $forbiddenIndex)',
          ({ word, forbiddenIndex, color, fixtureId }) => {
            const fx = fixtures.get(fixtureId)!;
            const message = sectionTitledStyleMessage(word, color);

            expect(extractExplicitSectionTitleIntent(message)).toBe(word);
            expect(scoreTitleMatch(fx.catalog.sections[forbiddenIndex]!.title, word)).toBe(0);

            const target = resolveEditTarget(message, fx.siteModel, fx.catalog);
            expect(target.needsClarification).toBe(true);
            expect(target.sectionIndex).not.toBe(forbiddenIndex);
          }
        );
      });

      describe('word-overlap unique matches', () => {
        it.each(suite.wordOverlapMatches.map((t) => ({ ...t, fixtureId: suite.id })))(
          'resolves phrase "$phrase" to index $expectedIndex',
          ({ phrase, expectedIndex, color, fixtureId }) => {
            const fx = fixtures.get(fixtureId)!;
            const message = sectionTitledStyleMessage(phrase, color);
            const sections = fx.catalog.sections.map((s) => ({
              index: s.index,
              title: s.title,
            }));

            expect(expectedExplicitTitleBehavior(phrase, sections)).toBe('match');
            expect(strongTitleMatches(phrase, sections)[0]?.index).toBe(expectedIndex);

            const target = resolveEditTarget(message, fx.siteModel, fx.catalog);
            expect(target.needsClarification).toBe(false);
            expect(target.sectionIndex).toBe(expectedIndex);
            expect(target.confidence).toBe('high');
          }
        );
      });

      describe('exact full title matches', () => {
        it.each(suite.exactTitleMatches.map((t) => ({ ...t, fixtureId: suite.id })))(
          'quoted full title resolves to index $expectedIndex',
          ({ title, expectedIndex, color, fixtureId }) => {
            const fx = fixtures.get(fixtureId)!;
            const message = quotedTitleStyleMessage(title, color);
            const target = resolveEditTarget(message, fx.siteModel, fx.catalog);

            expect(target.needsClarification).toBe(false);
            expect(target.sectionIndex).toBe(expectedIndex);
            expect(target.confidence).toBe('high');
          }
        );
      });

      describe('async resolver (SECTION_TARGET_LLM=1)', () => {
        afterEach(() => {
          vi.unstubAllEnvs();
        });

        it.each(suite.substringTraps.slice(0, 3).map((t) => ({ ...t, fixtureId: suite.id })))(
          'LLM cannot override clarify for "$word"',
          async ({ word, forbiddenIndex, color, fixtureId }) => {
            vi.stubEnv('SECTION_TARGET_LLM', '1');
            const fx = fixtures.get(fixtureId)!;
            const message = sectionTitledStyleMessage(word, color);
            const target = await resolveEditTargetAsync(message, fx.siteModel, fx.catalog);

            expect(target.needsClarification).toBe(true);
            expect(target.sectionIndex).not.toBe(forbiddenIndex);
          }
        );
      });
    });
  }

  describe('property: probe words from catalog titles', () => {
    for (const suite of TRAP_FIXTURE_SUITES) {
      it(`resolveEditTarget matches score model for all probe words (${suite.id})`, () => {
        const fx = fixtures.get(suite.id)!;
        const titles = fx.catalog.sections.map((s) => s.title);
        const probes = probeWordsFromTitles(titles);

        expect(probes.length).toBeGreaterThan(5);

        for (const intent of probes) {
          const message = sectionTitledStyleMessage(intent, 'yellow');
          assertResolveEditTargetMatchesExpectation(
            message,
            fx.catalog,
            fx.siteModel,
            intent
          );
          assertZeroScoreSectionsNeverHighConfidence(
            intent,
            fx.catalog,
            fx.siteModel,
            message
          );
        }
      });
    }
  });

  describe('default multi-section site (normal paths unchanged)', () => {
    it('first section ordinal still resolves without clarify', async () => {
      const workspacePath = await createSyntheticWorkspace({
        site: defaultMultiSectionSiteSpec(),
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      try {
        const built = await buildEditContext({
          workspacePath,
          mode: 'gitlab',
          ownerMessage: 'change background of first section to yellow',
          infraBaselineReady: true,
        });

        expect(built.needsClarification).toBe(false);
        expect(built.context.target.sectionIndex).toBe(0);

        const planResult = await planEdit({
          editContext: built.context,
          userPrompt: 'change background of first section to yellow',
          deterministicOnly: true,
        });

        expect(planResult.plan?.needsClarification).not.toBe(true);
        expect(planResult.plan?.steps.length).toBeGreaterThan(0);
      } finally {
        await destroySyntheticWorkspace(workspacePath);
      }
    });

    it('unknown explicit title on generic site clarifies', async () => {
      const workspacePath = await createSyntheticWorkspace({
        site: defaultMultiSectionSiteSpec(),
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      try {
        const message = sectionTitledStyleMessage('business', 'yellow');
        const built = await buildEditContext({
          workspacePath,
          mode: 'gitlab',
          ownerMessage: message,
          infraBaselineReady: true,
        });

        expect(built.needsClarification).toBe(true);
      } finally {
        await destroySyntheticWorkspace(workspacePath);
      }
    });
  });
});

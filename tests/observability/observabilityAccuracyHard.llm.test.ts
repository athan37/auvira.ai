/**
 * Hard observability accuracy A/B — control vs coached on scenarios where
 * Site Monitor coaching should recover from prior failure patterns.
 *
 * Run: npm run test:observability:accuracy:llm
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import {
  createContactInfoPanelWorkspace,
  CONTACT_SECTION_ANALYTICS_ID,
  EXISTING_SECTION_GRADIENT,
} from '../support/contactSectionWorkspace';
import {
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import {
  assertV3SectionBackgroundEdit,
  confusingTitlesSiteSpec,
  parseSections,
  sectionBackgroundClass,
} from '../edit-agent/editHarness';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { sectionPresentationCardClass } from '@/lib/project-workspace/previewReflectsSiteConfig';
import {
  accuracyScore,
  assertCoachedMeetsOrBeatsControl,
  buildCatalogClarification,
  COACHING_CARD_NOT_SECTION,
  COACHING_NUMBERED_REPLY,
  COACHING_RECENCY_OVERRIDE,
  COACHING_WRONG_NUMBER_CORRECTION,
  COACHING_WRONG_SECTION_INDEX,
  destroyAbWorkspaces,
  readSiteConfig,
  runObservabilityAb,
} from './observabilityAccuracyHarness';

describeRunLlmIntegration('observability accuracy hard A/B (control vs coached)', () => {
  let controlPath: string | undefined;
  let coachedPath: string | undefined;

  afterEach(async () => {
    await destroyAbWorkspaces(controlPath, coachedPath);
    controlPath = undefined;
    coachedPath = undefined;
  });

  it(
    'paraphrase target: customers talk about growth → testimonials purple (wrong-section coaching)',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const testimonialsIndex = 3;
      const testimonialsTitle = spec.sections[testimonialsIndex].title!;
      const ownerMessage =
        'Make the section where customers talk about growth have a purple background';

      const ab = await runObservabilityAb({
        siteSpec: spec,
        ownerMessage,
        coaching: COACHING_WRONG_SECTION_INDEX,
        sectionTargetLlm: true,
        controlProjectId: 'obs-hard-paraphrase-control',
        coachedProjectId: 'obs-hard-paraphrase-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateTarget = async (workspacePath: string) => {
        try {
          await assertV3SectionBackgroundEdit(workspacePath, {
            targetIndex: testimonialsIndex,
            targetType: 'testimonials',
            targetTitle: testimonialsTitle,
            ownerMessage,
            color: 'purple',
            unchangedIndices: [0, 4],
          });
          return true;
        } catch {
          return false;
        }
      };

      const controlValid = await validateTarget(controlPath);
      const coachedValid = await validateTarget(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'paraphrase-testimonials-purple',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });

      expect(coachedValid, 'coached arm should hit testimonials section index 3').toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'multi-turn numbered reply: deictic green → catalog pick applies gallery (numbered-reply coaching)',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const galleryIndex = 2;
      const galleryTitle = spec.sections[galleryIndex].title!;

      const catalogSeedPath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });
      const siteConfigContent = await readSiteConfig(catalogSeedPath);
      const pageContent = await readSyntheticFile(catalogSeedPath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
      await destroyAbWorkspaces(catalogSeedPath);

      const conversationHistory = [
        { role: 'user' as const, content: 'Change the background color of this section to green' },
        { role: 'assistant' as const, content: buildCatalogClarification(catalog) },
      ];
      const ownerMessage = `3 — ${galleryTitle}`;

      const ab = await runObservabilityAb({
        siteSpec: spec,
        ownerMessage,
        conversationHistory,
        coaching: COACHING_NUMBERED_REPLY,
        controlProjectId: 'obs-hard-numbered-control',
        coachedProjectId: 'obs-hard-numbered-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateTarget = async (workspacePath: string) => {
        try {
          await assertV3SectionBackgroundEdit(workspacePath, {
            targetIndex: galleryIndex,
            targetType: 'gallery',
            targetTitle: galleryTitle,
            ownerMessage: conversationHistory[0].content,
            color: 'green',
            unchangedIndices: [0, 4],
          });
          return true;
        } catch {
          return false;
        }
      };

      const controlValid = await validateTarget(controlPath);
      const coachedValid = await validateTarget(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'numbered-reply-gallery-green',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });

      expect(coachedValid, 'coached arm should apply green to gallery index 2').toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'recency override: owner corrects contact → grow-business yellow (stale-target coaching)',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const growIndex = 0;
      const growTitle = spec.sections[growIndex].title!;
      const contactTitle = spec.sections[4].title!;

      const conversationHistory = [
        { role: 'user' as const, content: `Change "${contactTitle}" background to yellow` },
        { role: 'assistant' as const, content: `Updated "${contactTitle}" background to yellow.` },
      ];
      const ownerMessage = `Sorry, I meant "${growTitle}" — make that one yellow instead`;

      const ab = await runObservabilityAb({
        siteSpec: spec,
        ownerMessage,
        conversationHistory,
        coaching: COACHING_RECENCY_OVERRIDE,
        controlProjectId: 'obs-hard-recency-control',
        coachedProjectId: 'obs-hard-recency-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateTarget = async (workspacePath: string) => {
        try {
          await assertV3SectionBackgroundEdit(workspacePath, {
            targetIndex: growIndex,
            targetType: 'services',
            targetTitle: growTitle,
            ownerMessage,
            color: 'yellow',
            colorFamily: true,
            unchangedIndices: [4],
          });
          return true;
        } catch {
          return false;
        }
      };

      const controlValid = await validateTarget(controlPath);
      const coachedValid = await validateTarget(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'recency-override-grow-yellow',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });

      expect(coachedValid, 'coached arm should apply yellow to grow-business section').toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'wrong catalog number then "1" correction → grow-business orange (catalog-correction coaching)',
    async () => {
      const spec = confusingTitlesSiteSpec();
      const growIndex = 0;
      const growTitle = spec.sections[growIndex].title!;

      const catalogSeedPath = await createSyntheticWorkspace({
        site: spec,
        pageMode: 'wired',
        tailwind: 'canonical',
      });
      const siteConfigContent = await readSiteConfig(catalogSeedPath);
      const pageContent = await readSyntheticFile(catalogSeedPath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
      await destroyAbWorkspaces(catalogSeedPath);

      const conversationHistory = [
        { role: 'user' as const, content: 'Change the background color of this section to orange' },
        { role: 'assistant' as const, content: buildCatalogClarification(catalog) },
        { role: 'user' as const, content: '5' },
        {
          role: 'assistant' as const,
          content: `Updated "${spec.sections[4].title}" background to orange.`,
        },
      ];
      const ownerMessage = '1';

      const ab = await runObservabilityAb({
        siteSpec: spec,
        ownerMessage,
        conversationHistory,
        coaching: COACHING_WRONG_NUMBER_CORRECTION,
        controlProjectId: 'obs-hard-wrong-num-control',
        coachedProjectId: 'obs-hard-wrong-num-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateTarget = async (workspacePath: string) => {
        const siteConfig = await readSiteConfig(workspacePath);
        const sections = parseSections(siteConfig);
        const section = sections[growIndex];
        if (!section) return false;
        const appliedClass = sectionBackgroundClass(section) ?? '';
        return (
          String(section.type) === 'services' &&
          String(section.title) === growTitle &&
          /^bg-orange-\d{3}$/.test(appliedClass)
        );
      };

      const controlValid = await validateTarget(controlPath);
      const coachedValid = await validateTarget(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'wrong-number-then-correct-to-grow',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });

      expect(coachedValid, 'coached arm should apply orange to grow section after "1" correction').toBe(
        true
      );
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'pinned contact card: inner gradient on cardClass not section bg (card-vs-section coaching)',
    async () => {
      const ownerMessage = 'edit the contact information background to green to red gradient';
      const selectedTarget = {
        kind: 'section' as const,
        sectionIndex: 0,
        sectionType: 'contact',
        sectionTitle: 'hi, this hema',
        sectionId: CONTACT_SECTION_ANALYTICS_ID,
        analyticsId: CONTACT_SECTION_ANALYTICS_ID,
      };

      const ab = await runObservabilityAb({
        createWorkspace: createContactInfoPanelWorkspace,
        ownerMessage,
        selectedTarget,
        coaching: COACHING_CARD_NOT_SECTION,
        controlProjectId: 'obs-hard-card-bg-control',
        coachedProjectId: 'obs-hard-card-bg-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateCardEdit = async (workspacePath: string) => {
        const siteConfig = await readSiteConfig(workspacePath);
        const sections = parseSections(siteConfig);
        const sectionBg = sectionBackgroundClass(sections[0] ?? {});
        if (sectionBg !== EXISTING_SECTION_GRADIENT) return false;

        const cardClass = sectionPresentationCardClass(siteConfig, 0);
        if (!cardClass) return false;
        return (
          cardClass.toLowerCase().includes('gradient') &&
          cardClass !== EXISTING_SECTION_GRADIENT &&
          /#16a34a|green/i.test(cardClass) &&
          /#ef4444|red/i.test(cardClass)
        );
      };

      const controlValid = await validateCardEdit(controlPath);
      const coachedValid = await validateCardEdit(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'contact-card-gradient-not-section',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });

      expect(
        coachedValid,
        'coached arm should set cardClass gradient without changing section background'
      ).toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

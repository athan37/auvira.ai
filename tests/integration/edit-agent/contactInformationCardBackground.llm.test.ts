/**
 * LLM integration: inner "Contact Information" panel background vs whole section background.
 *
 * Run: npm run test:llm -- tests/integration/edit-agent/contactInformationCardBackground.llm.test.ts
 */
import '../../llmTestGate';
import { afterEach, describe, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createContactInfoPanelWorkspace,
  CONTACT_SECTION_ANALYTICS_ID,
  EXISTING_SECTION_GRADIENT,
} from '../../support/contactSectionWorkspace';
import { destroySyntheticWorkspace, readSyntheticFile } from '../../support/syntheticSiteWorkspace';
import { parseSections } from '../../edit-agent/editHarness';
import { sectionPresentationCardClass } from '@/lib/project-workspace/previewReflectsSiteConfig';

function sectionBackgroundClass(section: Record<string, unknown>): string | undefined {
  const presentation = section.presentation as Record<string, unknown> | undefined;
  return typeof presentation?.backgroundClass === 'string'
    ? presentation.backgroundClass
    : undefined;
}

describeRunLlmIntegration('contact information card background (LLM integration)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'pinned contact section: contact information gradient updates cardClass, not section background',
    async () => {
      workspacePath = await createContactInfoPanelWorkspace();
      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sectionsBefore = parseSections(siteConfigBefore);
      expect(sectionBackgroundClass(sectionsBefore[0] ?? {})).toBe(EXISTING_SECTION_GRADIENT);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage:
          'edit the contact information background to green to red gradient',
        projectId: 'llm-contact-info-card-bg',
        mode: 'gitlab',
        infraBaselineReady: true,
        selectedTarget: {
          kind: 'section',
          sectionIndex: 0,
          sectionType: 'contact',
          sectionTitle: 'hi, this hema',
          sectionId: CONTACT_SECTION_ANALYTICS_ID,
          analyticsId: CONTACT_SECTION_ANALYTICS_ID,
        },
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sectionsAfter = parseSections(siteConfigAfter);

      const sectionBg = sectionBackgroundClass(sectionsAfter[0] ?? {});
      expect(sectionBg).toBe(EXISTING_SECTION_GRADIENT);

      const cardClass = sectionPresentationCardClass(siteConfigAfter, 0);
      expect(cardClass, 'cardClass should be set on inner Contact Information panel').toBeTruthy();
      expect(cardClass!.toLowerCase()).toMatch(/gradient/);
      expect(cardClass).not.toBe(EXISTING_SECTION_GRADIENT);
      expect(cardClass).toMatch(/#16a34a|green/i);
      expect(cardClass).toMatch(/#ef4444|red/i);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'pinned contact card container: generic gradient updates cardClass only',
    async () => {
      workspacePath = await createContactInfoPanelWorkspace();
      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sectionsBefore = parseSections(siteConfigBefore);
      expect(sectionBackgroundClass(sectionsBefore[0] ?? {})).toBe(EXISTING_SECTION_GRADIENT);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change the background to a color gradient',
        projectId: 'llm-contact-card-container-pin',
        mode: 'gitlab',
        infraBaselineReady: true,
        selectedTarget: {
          kind: 'section',
          sectionIndex: 0,
          sectionType: 'contact',
          sectionTitle: 'hi, this hema',
          sectionId: CONTACT_SECTION_ANALYTICS_ID,
          analyticsId: CONTACT_SECTION_ANALYTICS_ID,
          pinScope: 'section',
          targetChain: [
            { role: 'section', label: 'hi, this hema', kind: 'contact' },
            { role: 'container', label: 'Contact card', kind: 'inner_card' },
          ],
        },
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      expect(sectionBackgroundClass(parseSections(siteConfigAfter)[0] ?? {})).toBe(
        EXISTING_SECTION_GRADIENT
      );
      const cardClass = sectionPresentationCardClass(siteConfigAfter, 0);
      expect(cardClass).toBeTruthy();
      expect(cardClass!.toLowerCase()).toMatch(/gradient/);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

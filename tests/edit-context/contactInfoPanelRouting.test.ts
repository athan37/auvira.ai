import { describe, expect, it, afterEach } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { sectionPresentationCardClass } from '@/lib/project-workspace/previewReflectsSiteConfig';
import {
  createContactInfoPanelWorkspace,
  CONTACT_SECTION_ANALYTICS_ID,
  EXISTING_SECTION_GRADIENT,
} from '../support/contactSectionWorkspace';
import { destroySyntheticWorkspace, readSyntheticFile } from '../support/syntheticSiteWorkspace';
import { parseSections, sectionBackgroundClass } from '../edit-agent/editHarness';

describe('contact info panel workspace routing', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it('resolves pinned contact section and routes inner background to cardClass', async () => {
    workspacePath = await createContactInfoPanelWorkspace();
    const message =
      'edit the contact information background to green to red gradient';

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: message,
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

    expect(built.needsClarification, built.clarificationMessage).toBe(false);
    expect(built.context.target.sectionIndex).toBe(0);
    expect(built.context.selectedTargetContext?.styleTargets?.[1]?.presentationField).toBe(
      'cardClass'
    );

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_section_style');
    expect(plan?.steps[0]?.params?.presentationField).toBe('cardClass');
    expect(String(plan?.steps[0]?.params?.backgroundClass ?? '')).toMatch(/gradient/i);
  });

  it(
    'agent applies cardClass without clarification (deterministic path)',
    async () => {
      workspacePath = await createContactInfoPanelWorkspace();
      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sectionsBefore = parseSections(siteConfigBefore);
      expect(sectionBackgroundClass(sectionsBefore[0] ?? {})).toBe(EXISTING_SECTION_GRADIENT);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage:
          'edit the contact information background to green to red gradient',
        projectId: 'contact-info-card-bg-unit',
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
      expect(sectionBackgroundClass(parseSections(siteConfigAfter)[0] ?? {})).toBe(
        EXISTING_SECTION_GRADIENT
      );
      const cardClass = sectionPresentationCardClass(siteConfigAfter, 0);
      expect(cardClass).toBeTruthy();
      expect(cardClass!.toLowerCase()).toMatch(/gradient/);
    },
    120_000
  );

  it('routes pinned contact card container to cardClass for generic background requests', async () => {
    workspacePath = await createContactInfoPanelWorkspace();
    const message = 'change the background to a blue to green gradient';

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: message,
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

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.steps[0]?.skill).toBe('update_section_style');
    expect(plan?.steps[0]?.params?.presentationField).toBe('cardClass');
    expect(String(plan?.steps[0]?.params?.backgroundClass ?? '')).toMatch(/gradient/i);
  });

  it(
    'agent applies cardClass when contact card container is pinned (not section background)',
    async () => {
      workspacePath = await createContactInfoPanelWorkspace();
      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sectionsBefore = parseSections(siteConfigBefore);
      expect(sectionBackgroundClass(sectionsBefore[0] ?? {})).toBe(EXISTING_SECTION_GRADIENT);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: 'change the background to a color gradient',
        projectId: 'contact-card-container-pin',
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
    120_000
  );
});

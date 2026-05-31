import { describe, it, expect } from 'vitest';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { matchSectionFromMessage } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { assertExactSectionBackgroundInSiteConfig } from '../support/sectionColorEditContract';
import {
  assertV3EditSucceeded,
  assertV3SectionBackgroundEdit,
  confusingTitlesSiteSpec,
  parseSections,
  sectionBackgroundClass,
  similarVerbSiteSpec,
} from './editHarness';

describe('edit-agent hard (deterministic)', () => {
  it('deictic + quoted long title targets services, not contact', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const targetIndex = 0;
    const targetTitle = spec.sections[targetIndex].title!;
    const ownerMessage = `change this section background to blue "${targetTitle}"`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-hard-deictic-quote',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);
    expect(result.summary).toContain(targetTitle);

    const expectedClass = colorNameToBackgroundClass('blue', ownerMessage);
    expect(result.summary).toContain(expectedClass);

    await assertV3SectionBackgroundEdit(workspacePath, {
      targetIndex,
      targetType: 'services',
      targetTitle,
      ownerMessage,
      unchangedIndices: [4],
    });
  });

  it('colon suffix title resolves grow-business section', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const targetTitle = spec.sections[0].title!;
    const ownerMessage = `change the background color of this to red: ${targetTitle}`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-hard-colon-title',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);

    await assertV3SectionBackgroundEdit(workspacePath, {
      targetIndex: 0,
      targetType: 'services',
      targetTitle,
      ownerMessage,
      unchangedIndices: [1, 4],
    });
  });

  it('similar verb titles: "Getting Started Today" not "Get Started With Our Services"', async () => {
    const spec = similarVerbSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const contactIndex = 2;
    const contactTitle = spec.sections[contactIndex].title!;
    const ownerMessage = `change background of "${contactTitle}" to yellow`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-hard-similar-verb',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);

    await assertV3SectionBackgroundEdit(workspacePath, {
      targetIndex: contactIndex,
      targetType: 'contact',
      targetTitle: contactTitle,
      ownerMessage,
      unchangedIndices: [0],
    });
  });

  it('gradient regression writes only to quoted section in siteConfig', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const targetTitle = spec.sections[0].title!;
    const ownerMessage = `change this section background to color gradient "${targetTitle}"`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-hard-gradient',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);
    expect(result.summary).toMatch(/gradient/i);
    expect(result.summary).not.toMatch(/Get Started Today/i);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const sections = parseSections(siteConfig);
    const servicesBg = sectionBackgroundClass(sections[0] ?? {});
    const contactBg = sectionBackgroundClass(sections[4] ?? {});

    expect(servicesBg).toMatch(/gradient/);
    expect(contactBg ?? '').not.toMatch(/gradient/);
  });

  it('deictic-only style request clarifies without mutating siteConfig', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const before = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: 'change this section background to red',
      projectId: 'v3-hard-deictic-only',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.ownerMessage).toMatch(/which section/i);

    const after = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(after).toBe(before);
  });

  it('catalog matcher rejects single-word overlap between similar titles', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    const { buildSiteSectionCatalog } = await import(
      '@/lib/project-workspace/edit-shared/siteSectionCatalog'
    );
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const match = matchSectionFromMessage(
      'change background of section titled business to yellow',
      catalog
    );

    expect(match?.sectionIndex).not.toBe(0);
    expect(match?.confidence === 'low' || match?.sectionIndex == null).toBe(true);
  });

  it('quoted title before background applies gradient to testimonials not contact', async () => {
    const testimonialsTitle = 'Trusted by Over 400,000 Service Professionals';
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'testimonials', title: testimonialsTitle },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ownerMessage = `change this section "${testimonialsTitle}" background to color gradient`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-trusted-gradient',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);
    expect(result.summary).toMatch(/color gradient/i);
    expect(result.summary).toContain(testimonialsTitle);
    expect(result.summary).not.toMatch(/Get Started Today/i);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const sections = parseSections(siteConfig);
    expect(sectionBackgroundClass(sections[0] ?? {})).toMatch(/gradient/);
    expect(sectionBackgroundClass(sections[1] ?? {}) ?? '').not.toMatch(/gradient/);
  });

  it('make contact section red targets contact index exactly', async () => {
    const spec = confusingTitlesSiteSpec();
    const workspacePath = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const contactIndex = 4;
    const contactTitle = spec.sections[contactIndex].title!;
    const ownerMessage = `Make "${contactTitle}" section background red`;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v3-hard-contact-red',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    assertV3EditSucceeded(result);

    const expectedClass = colorNameToBackgroundClass('red', ownerMessage);
    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    assertExactSectionBackgroundInSiteConfig(siteConfig, contactIndex, {
      type: 'contact',
      title: contactTitle,
      backgroundClass: expectedClass,
    });

    const sections = parseSections(siteConfig);
    expect(sectionBackgroundClass(sections[0] ?? {})).not.toBe(expectedClass);
  });
});

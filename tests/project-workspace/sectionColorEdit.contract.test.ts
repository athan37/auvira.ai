/**
 * Generic agent contract tests — synthetic sites only, no project-specific fixtures.
 */
import { describe, expect, it } from 'vitest';
import {
  assertSectionColorEditContract,
  GENERIC_SECTION_COLOR_SCENARIOS,
  withSectionColorContract,
} from '../support/sectionColorEditContract';
import {
  assertSectionColorEditInvariants,
  assertSectionColorEditReady,
  applySectionBackgroundColorEdit,
} from '@/lib/project-workspace/sectionPresentationEdit';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  SYNTHETIC_SECTION_TYPES,
} from '../support/syntheticSiteWorkspace';
import { rendererComponentForSectionType } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';

describe('agent contracts: section background color (generic)', () => {
  it.each(GENERIC_SECTION_COLOR_SCENARIOS.map((s) => [s.name, s] as const))(
    '%s',
    async (_name, scenario) => {
      await withSectionColorContract(scenario, (result) => {
        assertSectionColorEditContract(result);
      });
    }
  );

  it('synthetic workspace factory supports every standard section type', async () => {
    for (const type of SYNTHETIC_SECTION_TYPES) {
      const workspacePath = await createSyntheticWorkspace({
        site: { sections: [{ type }] },
        pageMode: 'wired',
      });
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      expect(siteConfig).toContain(`type: '${type}'`);
      expect(page).toContain(rendererComponentForSectionType(type));
      await destroySyntheticWorkspace(workspacePath);
    }
  });

  it('invariants fail when legacy page is not wired after siteConfig-only write', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'contact' }] },
      pageMode: 'legacy',
    });
    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    const expectedClass = colorNameToBackgroundClass('red');

    const errors = assertSectionColorEditInvariants({
      siteConfigContent: siteConfig.replace(
        'items: []',
        `items: [], presentation: { backgroundClass: "${expectedClass}" }`
      ),
      pageContent: page,
      tailwindContent: await readSyntheticFile(workspacePath, 'tailwind.config.js'),
      sectionIndex: 0,
      rendererComponent: 'ContactSection',
      expectedBackgroundClass: expectedClass,
      infraBaselineReady: true,
      changedFiles: ['src/lib/siteConfig.ts'],
    });

    expect(errors.some((e) => e.includes('resolveSectionBackground'))).toBe(true);
    await destroySyntheticWorkspace(workspacePath);
  });

  it('post-edit gate fails on siteConfig-only write then passes after pipeline repair', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'gallery', title: 'Section 1 (gallery)' }] },
      pageMode: 'legacy',
      tailwind: 'canonical',
    });
    const expectedClass = colorNameToBackgroundClass('red');
    const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const pageBefore = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    const tailwind = await readSyntheticFile(workspacePath, 'tailwind.config.js');

    const siteConfigOnly = siteConfigBefore.replace(
      'items: []',
      `items: [], presentation: { backgroundClass: "${expectedClass}" }`
    );

    expect(() =>
      assertSectionColorEditReady({
        siteConfigContent: siteConfigOnly,
        pageContent: pageBefore,
        tailwindContent: tailwind,
        sectionIndex: 0,
        rendererComponent: 'GallerySection',
        expectedBackgroundClass: expectedClass,
        infraBaselineReady: true,
        changedFiles: ['src/lib/siteConfig.ts'],
      })
    ).toThrow(/resolveSectionBackground/);

    const pipeline = await applySectionBackgroundColorEdit({
      workspace: { workspacePath, ownerMessage: 'change gallery background to red' },
      sectionTarget: {
        sectionIndex: 0,
        sectionType: 'gallery',
        title: 'Section 1 (gallery)',
        rendererComponent: 'GallerySection',
      },
      colorName: 'red',
      projectInfraStatus: { infraBaselineReady: true },
    });

    expect(pipeline.ok, pipeline.invariantErrors.join('; ')).toBe(true);
    assertSectionColorEditReady({
      siteConfigContent: await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts'),
      pageContent: await readSyntheticFile(workspacePath, 'src/app/page.tsx'),
      tailwindContent: await readSyntheticFile(workspacePath, 'tailwind.config.js'),
      sectionIndex: 0,
      rendererComponent: 'GallerySection',
      expectedBackgroundClass: expectedClass,
      infraBaselineReady: true,
      changedFiles: pipeline.changedFiles,
    });

    await destroySyntheticWorkspace(workspacePath);
  });
});

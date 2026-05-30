/**
 * Frozen Jobber-style contact regression — runs after generic contract matrix.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { applySectionBackgroundColorEdit } from '@/lib/project-workspace/sectionPresentationEdit';
import { assertExactSectionBackgroundInSiteConfig } from '../support/sectionColorEditContract';
import {
  JOBBER_CONTACT_EXPECTED_CLASS,
  JOBBER_CONTACT_LEGACY_PAGE,
  JOBBER_CONTACT_SITE_CONFIG,
  JOBBER_LAST_SECTION_RED_MESSAGE,
} from '../fixtures/sectionColor/jobberContactLegacy';

describe('section color edit — frozen Jobber contact regression', () => {
  let workspacePath: string;

  afterEach(async () => {
    if (workspacePath) {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('last-section red on legacy Jobber contact wires resolver and saves bg-red-600', async () => {
    workspacePath = scratchPath('jobber-contact-regression', `${Date.now()}`);
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      JOBBER_CONTACT_SITE_CONFIG,
      'utf-8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'src/app/page.tsx'),
      JOBBER_CONTACT_LEGACY_PAGE,
      'utf-8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'tailwind.config.js'),
      `module.exports = { content: ["./src/app/**/*"] };`,
      'utf-8'
    );

    const pipeline = await applySectionBackgroundColorEdit({
      workspace: {
        workspacePath,
        ownerMessage: JOBBER_LAST_SECTION_RED_MESSAGE,
      },
      sectionTarget: {
        sectionIndex: 0,
        sectionType: 'contact',
        title: 'Get Started Today',
        rendererComponent: 'ContactSection',
      },
      colorName: 'red',
      projectInfraStatus: { infraBaselineReady: true },
    });

    expect(pipeline.ok, pipeline.invariantErrors.join('; ')).toBe(true);
    expect(pipeline.backgroundClass).toBe(JOBBER_CONTACT_EXPECTED_CLASS);
    expect(pipeline.summary).toContain(JOBBER_CONTACT_EXPECTED_CLASS);
    expect(pipeline.changedFiles).toContain('src/lib/siteConfig.ts');
    expect(pipeline.changedFiles).toContain('src/app/page.tsx');

    const siteConfig = await fs.readFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      'utf-8'
    );
    const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');

    assertExactSectionBackgroundInSiteConfig(siteConfig, 0, {
      type: 'contact',
      title: 'Get Started Today',
      backgroundClass: JOBBER_CONTACT_EXPECTED_CLASS,
    });
    expect(page).toContain('resolveSectionBackground(section, preset)');
  });
});

import { describe, it, expect } from 'vitest';
import { runWebsiteEditAgentV3 } from '@/lib/project-workspace/edit-agent-v3';
import { runWebsiteEditAgent } from '@/lib/project-workspace/website-edit-agent';
import {
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { sectionRendererUsesPresentationResolver } from '@/lib/project-workspace/previewReflectsSiteConfig';
import { parseSections, sectionBackgroundClass } from './v3HardHarness';

import {
  JOBBER_CONTACT_LEGACY_PAGE,
  JOBBER_CONTACT_SITE_CONFIG,
} from '../fixtures/sectionColor/jobberContactLegacy';
import { applySectionBackgroundColorEdit } from '@/lib/project-workspace/sectionPresentationEdit';
import {
  extractSectionBackgroundClassFromMessage,
  resolveGradientBackgroundClass,
} from '@/lib/builder/sectionPresentation';
import { buildDefaultGradientBackgroundClass } from '@/lib/builder/gradientBuilder';
import { isEmitableTailwindBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';
import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';

const ownerMessage =
  'change this section "Get Started Today" background to color gradient';

const blackWhiteOwnerMessage =
  'change this section "Get Started Today" background to back and white color gradient';

describe('Get Started Today gradient regression', () => {
  it('resolves black-and-white gradient classes (not white-400 shades)', () => {
    const expected = resolveGradientBackgroundClass(blackWhiteOwnerMessage);
    expect(expected).toContain('linear-gradient');
    expect(extractSectionBackgroundClassFromMessage(blackWhiteOwnerMessage)).toBe(expected);
    expect(
      isEmitableTailwindBackgroundClass(
        'bg-gradient-to-br from-white-400 via-white-600 to-white-900'
      )
    ).toBe(false);
  });

  it('V3 applies black-and-white gradient on Get Started Today (wired)', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Our Services' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgentV3({
      workspacePath,
      ownerMessage: blackWhiteOwnerMessage,
      projectId: 'v3-get-started-bw-gradient',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.summary).toMatch(/gradient/i);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const sections = parseSections(siteConfig);
    const contactBg = sectionBackgroundClass(sections[1] ?? {});
    expect(contactBg).toBe(resolveGradientBackgroundClass(blackWhiteOwnerMessage));
    expect(isEmitableTailwindBackgroundClass(contactBg ?? '')).toBe(true);
  });

  for (const pageMode of ['wired', 'legacy'] as const) {
    it(`V3 applies gradient on contact section (${pageMode} page)`, async () => {
      const workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Our Services' },
            { type: 'contact', title: 'Get Started Today' },
          ],
        },
        pageMode,
        tailwind: 'canonical',
      });

      const result = await runWebsiteEditAgentV3({
        workspacePath,
        ownerMessage,
        projectId: `v3-get-started-${pageMode}`,
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
      expect(result.summary).toMatch(/color gradient/i);
      expect(result.summary).not.toContain('bg-black');

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const sections = parseSections(siteConfig);
      const contactBg = sectionBackgroundClass(sections[1] ?? {});
      expect(contactBg).toMatch(/gradient/);
      expect(sectionRendererUsesPresentationResolver(page, 'ContactSection')).toBe(true);
    });
  }

  it('V1 section_style applies gradient (not bg-black) for quoted contact title', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Our Services' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'legacy',
      tailwind: 'canonical',
    });

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage,
      projectId: 'v1-get-started-gradient',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.summary).toBe(true);
    expect(result.strategy).toBe('section_style');
    expect(result.summary).toMatch(/color gradient/i);
    expect(result.summary).not.toContain('bg-black');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const sections = parseSections(siteConfig);
    expect(sectionBackgroundClass(sections[1] ?? {})).toMatch(/gradient/);
  });

  it('Jobber legacy contact page applies gradient class not bg-black', async () => {
    const workspacePath = scratchPath('jobber-gradient', `${Date.now()}`);
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), JOBBER_CONTACT_SITE_CONFIG, 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'src/app/page.tsx'), JOBBER_CONTACT_LEGACY_PAGE, 'utf-8');
    await fs.writeFile(
      path.join(workspacePath, 'tailwind.config.js'),
      `module.exports = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"] };`,
      'utf-8'
    );

    const pipeline = await applySectionBackgroundColorEdit({
      workspace: { workspacePath, ownerMessage },
      sectionTarget: {
        sectionIndex: 0,
        sectionType: 'contact',
        title: 'Get Started Today',
        rendererComponent: 'ContactSection',
      },
      backgroundClass: buildDefaultGradientBackgroundClass(),
      projectInfraStatus: { infraBaselineReady: true },
    });

    expect(pipeline.ok, pipeline.invariantErrors.join('; ')).toBe(true);
    expect(pipeline.backgroundClass).toMatch(/gradient/);
    expect(pipeline.summary).toMatch(/color gradient/i);
    expect(pipeline.summary).not.toContain('bg-black');

    await fs.rm(workspacePath, { recursive: true, force: true });
  });
});

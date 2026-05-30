import { afterEach, describe, expect, it } from 'vitest';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import { repairSectionPresentationWiringInWorkspace } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { presentationWiringIssues } from '@/lib/project-workspace/previewReflectsSiteConfig';
import { rendererComponentForSectionType } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  type SyntheticSectionType,
} from '../support/syntheticSiteWorkspace';

const RED_CLASS = colorNameToBackgroundClass('red');

function sectionStylePlan(
  sectionIndex: number,
  sectionType: SyntheticSectionType | string,
  title: string
): NonNullable<WebsiteEditAgentOptions['editTargetPlan']> {
  return {
    what: 'style_background',
    valueExplicit: true,
    structureBrief: '',
    codeBlocks: [],
    where: {
      kind: 'section',
      confidence: 'high',
      sectionIndex,
      sectionType: String(sectionType),
      title,
      rendererComponent: rendererComponentForSectionType(String(sectionType)),
      matches: [],
    },
  };
}

async function createLegacySectionWorkspace(
  sectionType: SyntheticSectionType | string
): Promise<{ workspacePath: string; title: string }> {
  const title = `Section 1 (${sectionType})`;
  const workspacePath = await createSyntheticWorkspace({
    site: { sections: [{ type: sectionType, title }] },
    pageMode: 'legacy',
    tailwind: 'minimal',
  });
  return { workspacePath, title };
}

describe('section style legacy preview wiring e2e (synthetic)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it('repair + section_style wires gallery and saves red backgroundClass', async () => {
    const fixture = await createLegacySectionWorkspace('gallery');
    workspacePath = fixture.workspacePath;
    const { title } = fixture;

    await repairSectionPresentationWiringInWorkspace(workspacePath);

    const pageAfterRepair = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    expect(pageAfterRepair).toContain('resolveSectionBackground(section, preset)');

    const result = await runSectionStyleStrategy(
      {
        workspacePath,
        ownerMessage: `Change the "${title}" section background from blue to red`,
        projectId: 'synthetic-legacy-gallery-red',
        mode: 'gitlab',
        editTargetPlan: sectionStylePlan(0, 'gallery', title),
        infraBaselineReady: true,
      },
      {}
    );

    expect(result?.ok).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');

    expect(siteConfig).toContain(`"backgroundClass": "${RED_CLASS}"`);
    expect(presentationWiringIssues(siteConfig, page)).toEqual([]);
    expect(page).toContain('resolveSectionBackground(section, preset)');
  });

  it('survives repeated edit cycles on legacy gallery workspace', async () => {
    const fixture = await createLegacySectionWorkspace('gallery');
    workspacePath = fixture.workspacePath;
    const { title } = fixture;

    await repairSectionPresentationWiringInWorkspace(workspacePath);

    const plan = sectionStylePlan(0, 'gallery', title);
    const colors = ['red', 'blue', 'yellow'] as const;

    for (const color of colors) {
      const expected = colorNameToBackgroundClass(color);
      const result = await runSectionStyleStrategy(
        {
          workspacePath,
          ownerMessage: `Change gallery background to ${color}`,
          projectId: 'synthetic-legacy-gallery-cycle',
          mode: 'gitlab',
          editTargetPlan: plan,
          infraBaselineReady: true,
        },
        {}
      );
      expect(result?.ok).toBe(true);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      expect(siteConfig).toContain(`"backgroundClass": "${expected}"`);
    }
  });

  it('wires contact section and applies solid red background for last-section edit', async () => {
    const fixture = await createLegacySectionWorkspace('contact');
    workspacePath = fixture.workspacePath;
    const { title } = fixture;

    const result = await runSectionStyleStrategy(
      {
        workspacePath,
        ownerMessage: 'change background color of the last section to red',
        projectId: 'synthetic-legacy-contact-red',
        mode: 'gitlab',
        editTargetPlan: sectionStylePlan(0, 'contact', title),
        infraBaselineReady: true,
      },
      {}
    );

    expect(result?.ok).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');

    expect(siteConfig).toContain('"backgroundClass": "bg-red-600"');
    expect(page).toContain('resolveSectionBackground(section, preset)');
    expect(presentationWiringIssues(siteConfig, page)).toEqual([]);
  });
});

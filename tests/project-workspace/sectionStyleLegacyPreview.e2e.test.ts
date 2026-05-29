import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import { repairSectionPresentationWiringInWorkspace } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { presentationWiringIssues } from '@/lib/project-workspace/previewReflectsSiteConfig';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';

const RED_CLASS = colorNameToBackgroundClass('red');

const LEGACY_GALLERY_PAGE = `import { siteConfig } from "../lib/siteConfig";

const preset = { mutedBg: "bg-blue-200", surfaceBg: "bg-white", card: "border bg-white" };

function GallerySection({ section }) {
  return <section className={"px-4 py-20 " + preset.mutedBg}>{section.title}</section>;
}

function SectionRenderer({ section }) {
  if (section.type === "gallery") return <GallerySection section={section} />;
  return null;
}

export default function Home() {
  return <main>{siteConfig.sections.map((s, i) => <SectionRenderer key={i} section={s} />)}</main>;
}`;

const SITE_CONFIG = `export const siteConfig = {
  businessName: 'Jobber',
  sections: [
    {
      type: 'gallery',
      title: 'hello this is david',
      body: 'Gallery',
      items: [],
    },
  ],
};`;

const TAILWIND = `module.exports = { content: ["./src/app/**/*"] };`;

describe('section style legacy preview wiring e2e', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = scratchPath('legacy-style-e2e', `${Date.now()}`);
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'src/app/page.tsx'), LEGACY_GALLERY_PAGE, 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), SITE_CONFIG, 'utf-8');
    await fs.writeFile(path.join(workspacePath, 'tailwind.config.js'), TAILWIND, 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('repair + section_style wires gallery and saves red backgroundClass', async () => {
    await repairSectionPresentationWiringInWorkspace(workspacePath);

    const pageAfterRepair = await fs.readFile(
      path.join(workspacePath, 'src/app/page.tsx'),
      'utf-8'
    );
    expect(pageAfterRepair).toContain('resolveSectionBackground(section, preset)');

    const plan: WebsiteEditAgentOptions['editTargetPlan'] = {
      what: 'style_background',
      valueExplicit: true,
      structureBrief: '',
      codeBlocks: [],
      where: {
        kind: 'section',
        confidence: 'high',
        sectionIndex: 0,
        sectionType: 'gallery',
        title: 'hello this is david',
        rendererComponent: 'GallerySection',
        matches: [],
      },
    };

    const result = await runSectionStyleStrategy(
      {
        workspacePath,
        ownerMessage: 'Change the gallery section background from blue to red',
        projectId: 'legacy-gallery-red',
        mode: 'gitlab',
        editTargetPlan: plan,
        infraBaselineReady: true,
      },
      {}
    );

    expect(result?.ok).toBe(true);

    const siteConfig = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');

    expect(siteConfig).toContain(`"backgroundClass": "${RED_CLASS}"`);
    expect(presentationWiringIssues(siteConfig, page)).toEqual([]);
    expect(page).toContain('resolveSectionBackground(section, preset)');
  });

  it('survives repeated edit cycles on legacy gallery workspace', async () => {
    await repairSectionPresentationWiringInWorkspace(workspacePath);

    const plan: WebsiteEditAgentOptions['editTargetPlan'] = {
      what: 'style_background',
      valueExplicit: true,
      structureBrief: '',
      codeBlocks: [],
      where: {
        kind: 'section',
        confidence: 'high',
        sectionIndex: 0,
        sectionType: 'gallery',
        title: 'hello this is david',
        rendererComponent: 'GallerySection',
        matches: [],
      },
    };

    const colors = ['red', 'blue', 'yellow'] as const;
    for (const color of colors) {
      const expected = colorNameToBackgroundClass(color);
      const result = await runSectionStyleStrategy(
        {
          workspacePath,
          ownerMessage: `Change gallery background to ${color}`,
          projectId: 'legacy-gallery-cycle',
          mode: 'gitlab',
          editTargetPlan: plan,
          infraBaselineReady: true,
        },
        {}
      );
      expect(result?.ok).toBe(true);
      const siteConfig = await fs.readFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        'utf-8'
      );
      expect(siteConfig).toContain(`"backgroundClass": "${expected}"`);
    }
  });
});

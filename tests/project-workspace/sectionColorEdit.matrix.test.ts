import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { rendererComponentForSectionType } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import {
  applySectionBackgroundEdit,
  assertSectionColorEditInvariants,
} from '@/lib/project-workspace/sectionPresentationEdit';
import { sectionRendererUsesPresentationResolver } from '@/lib/project-workspace/previewReflectsSiteConfig';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';

const EXPECTED_RED = colorNameToBackgroundClass('red');

type SectionFixture = {
  type: string;
  title: string;
  presetKey: string;
};

const SECTION_FIXTURES: SectionFixture[] = [
  { type: 'services', title: 'Our Services', presetKey: 'surfaceBg' },
  { type: 'testimonials', title: 'Customer Reviews', presetKey: 'surfaceBg' },
  { type: 'gallery', title: 'Photo Gallery', presetKey: 'mutedBg' },
  { type: 'faq', title: 'Common Questions', presetKey: 'mutedBg' },
  { type: 'contact', title: 'Get In Touch', presetKey: 'contactBg' },
  { type: 'about', title: 'About Our Team', presetKey: 'mutedBg' },
  { type: 'generic', title: 'More Info', presetKey: 'surfaceBg' },
];

function legacyPageForSection(type: string, presetKey: string): string {
  const component = rendererComponentForSectionType(type);
  return `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = { ${presetKey}: "bg-slate-200", surfaceBg: "bg-white", mutedBg: "bg-slate-100", contactBg: "bg-slate-900", card: "border bg-white" };

function ${component}({ section }) {
  return <section className={"px-4 py-16 " + preset.${presetKey}}>{section.title}</section>;
}

function SectionRenderer({ section }) {
  if (section.type === "${type}") return <${component} section={section} />;
  return null;
}

export default function Home() {
  return <main>{siteConfig.sections.map((s, i) => <SectionRenderer key={i} section={s} />)}</main>;
}`;
}

function wiredPageForSection(type: string): string {
  const component = rendererComponentForSectionType(type);
  return `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = { surfaceBg: "bg-white", mutedBg: "bg-slate-100", contactBg: "bg-slate-900", card: "border bg-white" };

function ${component}({ section }) {
  return <section className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>{section.title}</section>;
}

function SectionRenderer({ section }) {
  if (section.type === "${type}") return <${component} section={section} />;
  return null;
}

export default function Home() {
  return <main>{siteConfig.sections.map((s, i) => <SectionRenderer key={i} section={s} />)}</main>;
}`;
}

function siteConfigForSection(type: string, title: string): string {
  return `export const siteConfig = {
  businessName: 'Test Co',
  sections: [
    { type: '${type}', title: '${title}', body: 'Body copy', items: [] }
  ],
};`;
}

const CANONICAL_TAILWIND = `module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    { pattern: /^bg-(red|yellow|blue|green|orange|purple|pink|teal|cyan|indigo|gray|grey|brown|black|white)-(50|100|200|300|400|500|600|700|800|900)$/ },
  ],
};`;

describe('section color edit matrix', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = scratchPath('section-color-matrix', `${Date.now()}-${Math.random()}`);
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, 'tailwind.config.js'), CANONICAL_TAILWIND, 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  describe.each(SECTION_FIXTURES)('$type section', ({ type, title, presetKey }) => {
    it('infra ready: siteConfig only when page already wired', async () => {
      await fs.writeFile(
        path.join(workspacePath, 'src/app/page.tsx'),
        wiredPageForSection(type),
        'utf-8'
      );
      await fs.writeFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        siteConfigForSection(type, title),
        'utf-8'
      );

      const result = await applySectionBackgroundEdit({
        workspace: {
          workspacePath,
          ownerMessage: `change ${title} background to red`,
        },
        sectionTarget: { sectionIndex: 0, sectionType: type, title },
        colorName: 'red',
        projectInfraStatus: { infraBaselineReady: true },
      });

      expect(result.ok).toBe(true);
      expect(result.backgroundClass).toBe(EXPECTED_RED);
      expect(result.changedFiles).toEqual(['src/lib/siteConfig.ts']);
      expect(result.summary).toContain(title);
      expect(result.summary).toContain(EXPECTED_RED);

      const siteConfig = await fs.readFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        'utf-8'
      );
      const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
      expect(siteConfig).toContain(`"backgroundClass": "${EXPECTED_RED}"`);
      expect(sectionRendererUsesPresentationResolver(page, rendererComponentForSectionType(type))).toBe(
        true
      );
    });

    it('infra ready: wires legacy page when preset background is hardcoded', async () => {
      await fs.writeFile(
        path.join(workspacePath, 'src/app/page.tsx'),
        legacyPageForSection(type, presetKey),
        'utf-8'
      );
      await fs.writeFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        siteConfigForSection(type, title),
        'utf-8'
      );

      const result = await applySectionBackgroundEdit({
        workspace: { workspacePath, ownerMessage: 'change background to red' },
        sectionTarget: { sectionIndex: 0, sectionType: type, title },
        colorName: 'red',
        projectInfraStatus: { infraBaselineReady: true },
      });

      expect(result.ok).toBe(true);
      expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
      expect(result.changedFiles).toContain('src/app/page.tsx');
      expect(result.changedFiles).not.toContain('tailwind.config.js');
    });

    it('legacy infra: full repair path when infra not ready', async () => {
      await fs.writeFile(
        path.join(workspacePath, 'src/app/page.tsx'),
        legacyPageForSection(type, presetKey),
        'utf-8'
      );
      await fs.writeFile(
        path.join(workspacePath, 'src/lib/siteConfig.ts'),
        siteConfigForSection(type, title),
        'utf-8'
      );
      await fs.writeFile(
        path.join(workspacePath, 'tailwind.config.js'),
        'module.exports = { content: ["./src/app/**/*"] };',
        'utf-8'
      );

      const result = await applySectionBackgroundEdit({
        workspace: { workspacePath, ownerMessage: 'change background to red' },
        sectionTarget: { sectionIndex: 0, sectionType: type, title },
        colorName: 'red',
        projectInfraStatus: { infraBaselineReady: false },
      });

      expect(result.ok).toBe(true);
      expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
      expect(result.changedFiles).toContain('src/app/page.tsx');
      expect(result.changedFiles).toContain('tailwind.config.js');
    });
  });

  it('hero is out of scope for siteConfig section pipeline', () => {
    expect(SECTION_FIXTURES.some((s) => s.type === 'hero')).toBe(false);
  });

  it('assertSectionColorEditInvariants catches unwired renderer', () => {
    const siteConfig = `export const siteConfig = {
  sections: [{ type: 'contact', title: 'Contact Us', presentation: { backgroundClass: "${EXPECTED_RED}" } }]
};`;
    const page = legacyPageForSection('contact', 'contactBg');
    const errors = assertSectionColorEditInvariants({
      siteConfigContent: siteConfig,
      pageContent: page,
      tailwindContent: CANONICAL_TAILWIND,
      sectionIndex: 0,
      rendererComponent: 'ContactSection',
      expectedBackgroundClass: EXPECTED_RED,
      infraBaselineReady: true,
      changedFiles: ['src/lib/siteConfig.ts'],
    });
    expect(errors.some((e) => e.includes('resolveSectionBackground'))).toBe(true);
  });
});

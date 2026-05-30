/**
 * Website-agnostic synthetic Next.js workspaces for agent/edit contract tests.
 * No business-specific copy, fixtures, or project IDs — only structure + wiring mode.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import type { SiteModel } from '@/lib/project-workspace/website-edit-agent-v2';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { defaultSectionBackgroundKey } from '@/lib/builder/sectionPresentation';
import { rendererComponentForSectionType } from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import { scratchPath } from '@/lib/runtime/scratchDir';

/** Supported section types for synthetic sites (extensible). */
export const SYNTHETIC_SECTION_TYPES = [
  'services',
  'about',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'generic',
  'features',
] as const;

export type SyntheticSectionType = (typeof SYNTHETIC_SECTION_TYPES)[number];

export type SyntheticSectionSpec = {
  type: SyntheticSectionType | string;
  /** Defaults to generic label derived from type + index. */
  title?: string;
};

export type SyntheticSiteSpec = {
  /** Defaults to random synthetic business id. */
  businessName?: string;
  sections: SyntheticSectionSpec[];
};

export type PageRendererMode = 'wired' | 'legacy';

export type TailwindMode = 'canonical' | 'minimal';

export type CreateSyntheticWorkspaceOptions = {
  site: SyntheticSiteSpec;
  /** How section renderers read background (presentation resolver vs preset.*). */
  pageMode: PageRendererMode;
  tailwind?: TailwindMode;
  /** Optional stable scratch sub-id (otherwise random). */
  workspaceId?: string;
};

const PRESET_KEYS = [
  'pageBg',
  'surfaceBg',
  'mutedBg',
  'contactBg',
  'card',
] as const;

function presetKeyForSectionType(type: string): string {
  return defaultSectionBackgroundKey(type);
}

function defaultTitle(type: string, index: number): string {
  return `Section ${index + 1} (${type})`;
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Build siteConfig.ts source from a generic site spec. */
export function buildSyntheticSiteConfigSource(spec: SyntheticSiteSpec): string {
  const businessName = spec.businessName ?? `Synthetic Site ${randomUUID().slice(0, 8)}`;
  const sectionLines = spec.sections.map((section, index) => {
    const title = section.title ?? defaultTitle(String(section.type), index);
    const type = String(section.type);
    return `    { type: '${type}', title: '${escapeJsString(title)}', body: 'Synthetic body', items: [] }`;
  });

  return `export const siteConfig = {
  businessName: '${escapeJsString(businessName)}',
  hero: { headline: 'Synthetic hero', subheadline: 'Synthetic tagline' },
  contact: {},
  sections: [
${sectionLines.join(',\n')}
  ],
};`;
}

function renderSectionComponent(
  type: string,
  mode: PageRendererMode
): { componentName: string; source: string } {
  const componentName = rendererComponentForSectionType(type);
  const presetKey = presetKeyForSectionType(type);
  const bgExpr =
    mode === 'wired'
      ? 'resolveSectionBackground(section, preset)'
      : `preset.${presetKey}`;

  const source = `function ${componentName}({ section }) {
  return (
    <section data-section-type="${type}" className={"px-4 py-16 " + ${bgExpr}}>
      {section.title}
    </section>
  );
}`;

  return { componentName, source };
}

/** Build page.tsx with one renderer per section type in the spec. */
export function buildSyntheticPageSource(
  spec: SyntheticSiteSpec,
  mode: PageRendererMode
): string {
  const types = [...new Set(spec.sections.map((s) => String(s.type)))];
  const components = types.map((type) => renderSectionComponent(type, mode));

  const switchCases = types
    .map((type) => {
      const name = rendererComponentForSectionType(type);
      return `    case "${type}": return <${name} section={section} />;`;
    })
    .join('\n');

  const presetInit = PRESET_KEYS.map((k) => `${k}: "bg-slate-200"`).join(', ');

  return `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = { ${presetInit}, card: "border bg-white" };

${components.map((c) => c.source).join('\n\n')}

function SectionRenderer({ section }) {
  switch (section.type) {
${switchCases}
    default:
      return null;
  }
}

export default function Home() {
  return (
    <main>
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={index} section={section} />
      ))}
    </main>
  );
}
`;
}

export function buildSyntheticTailwindConfig(mode: TailwindMode): string {
  if (mode === 'minimal') {
    return `module.exports = { content: ["./src/app/**/*"] };`;
  }
  return `module.exports = {
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
}

/** Create a scratch workspace from a generic site spec. */
export async function createSyntheticWorkspace(
  options: CreateSyntheticWorkspaceOptions
): Promise<string> {
  const id = options.workspaceId ?? randomUUID().slice(0, 8);
  const dir = scratchPath('project-workspaces', `synthetic-${id}`);
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });

  const siteConfig = buildSyntheticSiteConfigSource(options.site);
  const page = buildSyntheticPageSource(options.site, options.pageMode);
  const tailwind = buildSyntheticTailwindConfig(options.tailwind ?? 'canonical');

  await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/page.tsx'), page, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body {}', 'utf-8');
  await fs.writeFile(path.join(dir, 'tailwind.config.js'), tailwind, 'utf-8');

  return dir;
}

/** Standard multi-section site for agent routing tests (generic titles, all wired). */
export function defaultMultiSectionSiteSpec(): SyntheticSiteSpec {
  return {
    sections: SYNTHETIC_SECTION_TYPES.filter((t) => t !== 'features').map((type, index) => ({
      type,
      title: `Section ${index + 1} (${type})`,
    })),
  };
}

export async function readSyntheticFile(
  workspacePath: string,
  rel: 'src/lib/siteConfig.ts' | 'src/app/page.tsx' | 'tailwind.config.js'
): Promise<string> {
  return fs.readFile(path.join(workspacePath, rel), 'utf-8');
}

export async function destroySyntheticWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true });
}

/** Map synthetic site spec to V2 SiteModel for planner LLM tests. */
export function buildSyntheticSiteModel(
  spec: SyntheticSiteSpec = defaultMultiSectionSiteSpec()
): SiteModel {
  const businessName = spec.businessName ?? 'Synthetic Site';
  return {
    mode: 'gitlab',
    businessName,
    hero: { headline: 'Synthetic hero', subheadline: 'Synthetic tagline' },
    contact: {},
    sections: spec.sections.map((section, index) => ({
      index,
      type: String(section.type),
      title: section.title ?? defaultTitle(String(section.type), index),
      body: 'Synthetic body',
      itemCount: 0,
      items: [],
    })),
    files: [],
    capabilities: {
      hasSiteConfig: true,
      hasPage: true,
      hasGlobalsCss: true,
      supportsConfigSkills: true,
    },
  };
}

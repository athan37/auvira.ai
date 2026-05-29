import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SITECONFIG_PRESENTATION_SYNC_EXPORT } from '@/lib/site-manager/siteConfigAgentMarkers';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import * as legacyPresentation from '@/lib/project-workspace/website-edit-agent/legacySectionPresentation';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';

const LEGACY_PAGE = `function GallerySection({ section }) {
  return <section className={"py-20 " + preset.mutedBg}>{section.title}</section>;
}`;

const SITE_CONFIG = `export const siteConfig = {
  sections: [{ type: "gallery", title: "Get Started Today" }],
};`;

const TAILWIND = `module.exports = { content: ["./src/app/**/*"] };`;

describe('runSectionStyleStrategy with infra baseline ready', () => {
  const files = new Map<string, string>([
    ['src/lib/siteConfig.ts', SITE_CONFIG],
    ['src/app/page.tsx', LEGACY_PAGE],
    ['tailwind.config.js', TAILWIND],
  ]);

  let hashVersion = 0;
  const gateway = {
    readFile: vi.fn(async (rel: string) => files.get(rel) ?? null),
    writeFile: vi.fn(async (rel: string, content: string) => {
      files.set(rel, content);
      hashVersion += 1;
    }),
    computeHashes: vi.fn(async () => ({
      'src/lib/siteConfig.ts': `h-${hashVersion}`,
      'src/app/page.tsx': `p-${hashVersion}`,
      'tailwind.config.js': `t-${hashVersion}`,
    })),
  };

  const basePlan: WebsiteEditAgentOptions['editTargetPlan'] = {
    what: 'style_background',
    valueExplicit: true,
    structureBrief: '',
    codeBlocks: [],
    where: {
      kind: 'section',
      confidence: 'high',
      sectionIndex: 0,
      sectionType: 'gallery',
      title: 'Get Started Today',
      rendererComponent: 'GallerySection',
      matches: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    files.set('src/lib/siteConfig.ts', SITE_CONFIG);
    files.set('src/app/page.tsx', LEGACY_PAGE);
    files.set('tailwind.config.js', TAILWIND);
    vi.spyOn(legacyPresentation, 'ensureTailwindPresentationSupport');
    vi.spyOn(legacyPresentation, 'ensureLegacyPageReadsPresentation');
  });

  it('only mutates siteConfig when infra baseline is ready', async () => {
    const options: WebsiteEditAgentOptions = {
      workspacePath: '/tmp/ws',
      ownerMessage: 'change background of first section to yellow',
      projectId: 'test',
      mode: 'gitlab',
      gateway: gateway as unknown as WebsiteEditAgentOptions['gateway'],
      editTargetPlan: basePlan,
      infraBaselineReady: true,
    };

    const result = await runSectionStyleStrategy(options, {});
    expect(result?.ok).toBe(true);
    expect(legacyPresentation.ensureTailwindPresentationSupport).not.toHaveBeenCalled();
    expect(legacyPresentation.ensureLegacyPageReadsPresentation).not.toHaveBeenCalled();

    expect(files.get('src/lib/siteConfig.ts')).toContain('bg-yellow-200');
    expect(files.get('src/lib/siteConfig.ts')).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
    expect(files.get('src/app/page.tsx')).toBe(LEGACY_PAGE);
    expect(files.get('tailwind.config.js')).toBe(TAILWIND);

    const writtenPaths = gateway.writeFile.mock.calls.map((c) => c[0]);
    expect(writtenPaths).toEqual(['src/lib/siteConfig.ts']);
  });
});

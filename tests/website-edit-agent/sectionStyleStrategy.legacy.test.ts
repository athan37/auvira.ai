import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';

const LEGACY_PAGE = `function GallerySection({ section }) {
  return <section className={"py-20 " + preset.mutedBg}>{section.title}</section>;
}`;

const SITE_CONFIG = `export const siteConfig = {
  sections: [{ type: "gallery", title: "Get Started Today" }],
};`;

describe('runSectionStyleStrategy legacy page wiring', () => {
  const files = new Map<string, string>([
    ['src/lib/siteConfig.ts', SITE_CONFIG],
    ['src/app/page.tsx', LEGACY_PAGE],
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
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    files.set('src/lib/siteConfig.ts', SITE_CONFIG);
    files.set('src/app/page.tsx', LEGACY_PAGE);
  });

  it('updates siteConfig and wires page.tsx to presentation resolver', async () => {
    const options: WebsiteEditAgentOptions = {
      workspacePath: '/tmp/ws',
      ownerMessage: 'change background of first section to yellow',
      projectId: 'test',
      mode: 'gitlab',
      infraBaselineReady: false,
      gateway: gateway as unknown as WebsiteEditAgentOptions['gateway'],
      editTargetPlan: {
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
      },
    };

    const result = await runSectionStyleStrategy(options, {});
    expect(result?.ok).toBe(true);
    expect(result?.summary).toContain('to yellow');
    expect(result?.summary).not.toContain('from yellow to yellow');

    const siteConfig = files.get('src/lib/siteConfig.ts')!;
    expect(siteConfig).toContain('bg-yellow-200');

    const page = files.get('src/app/page.tsx')!;
    expect(page).toContain('resolveSectionBackground(section, preset)');
  });
});

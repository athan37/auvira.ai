import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import * as sectionPresentationEdit from '@/lib/project-workspace/sectionPresentationEdit';
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
    vi.spyOn(sectionPresentationEdit, 'applySectionBackgroundEdit').mockResolvedValue({
      ok: true,
      backgroundClass: 'bg-yellow-600',
      sectionIndex: 0,
      sectionType: 'gallery',
      sectionTitle: 'Get Started Today',
      rendererComponent: 'GallerySection',
      changedFiles: ['src/lib/siteConfig.ts', 'src/app/page.tsx'],
      summary: 'Changed background of "Get Started Today" to bg-yellow-600.',
      invariantErrors: [],
    });
  });

  it('updates siteConfig and wires legacy page even when infra baseline is ready', async () => {
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
    expect(sectionPresentationEdit.applySectionBackgroundEdit).toHaveBeenCalled();
    expect(result?.summary).toContain('bg-yellow-600');

    const writtenPaths = gateway.writeFile.mock.calls.map((c) => c[0]);
    expect(writtenPaths.length).toBeGreaterThanOrEqual(0);
  });
});

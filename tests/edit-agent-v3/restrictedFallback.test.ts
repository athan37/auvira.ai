import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { runRestrictedCustomCodeEdit } from '@/lib/project-workspace/edit-agent-v3/restrictedFallback';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { SiteSectionCatalog } from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';

function mockEditContext(workspacePath: string): EditContext {
  return {
    workspacePath,
    mode: 'gitlab',
    ownerMessage: 'custom edit',
    effectiveMessage: 'custom edit',
    siteModel: {
      workspacePath,
      mode: 'gitlab',
      archetype: 'section_loop',
      siteConfigPath: 'src/lib/siteConfig.ts',
      pagePath: 'src/app/page.tsx',
      indexHtmlPath: null,
      siteJsonPath: null,
      stylesPath: null,
      siteConfigContent: null,
      pageContent: null,
      indexHtmlContent: null,
      siteJsonContent: null,
      parsedConfig: null,
      structure: null,
      errors: [],
    },
    sectionCatalog: {
      sections: [],
      textBlock: '',
      numberedReplies: [],
      snapshot: {
        sections: [],
        structureMap: '',
        sectionTypesInConfig: [],
        sectionTypesInPage: [],
        rendersFromSiteConfig: true,
        hasGalleryRenderer: false,
        hasGenericRenderer: false,
        defaultRendersNull: false,
        heroHasImageSlot: false,
      },
    } satisfies SiteSectionCatalog,
    sections: [],
    target: {
      kind: 'site',
      confidence: 'medium',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: ['src/lib/siteConfig.ts'],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [{ kind: 'generic' }] },
    infraBaselineReady: true,
  };
}

describe('restrictedFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks write_file before read_file on the same path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'v3-restricted-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      'export const siteConfig = { contact: { phone: "old" } };',
      'utf-8'
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: 'export const siteConfig = { contact: { phone: "new" } };',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'read_file',
              args: { path: 'src/lib/siteConfig.ts' },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: 'export const siteConfig = { contact: { phone: "new" } };',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'finish',
              args: { summary: 'Updated phone', ownerMessage: 'Updated phone.' },
            },
          },
        }),
    } as never);

    const result = await runRestrictedCustomCodeEdit(
      mockEditContext(dir),
      'Update phone',
      async () => true
    );

    expect(result.ok).toBe(true);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
    const content = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(content).toContain('"new"');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('blocks writes outside allowedWritePaths', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'v3-restricted-block-'));
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src/app/page.tsx'), 'export default function Home() { return null; }', 'utf-8');

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          action: {
            tool: 'write_file',
            args: {
              path: 'src/app/page.tsx',
              content: 'export default function Home() { return <main />; }',
            },
          },
        },
      }),
    } as never);

    const result = await runRestrictedCustomCodeEdit(
      mockEditContext(dir),
      'Edit page',
      async () => true
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/max iterations/i);

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rejects finish when verification fails', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'v3-restricted-verify-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      'export const siteConfig = { contact: { phone: "old" } };',
      'utf-8'
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: { tool: 'read_file', args: { path: 'src/lib/siteConfig.ts' } },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: 'export const siteConfig = { contact: { phone: "new" } };',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            action: {
              tool: 'finish',
              args: { summary: 'Done', ownerMessage: 'Done.' },
            },
          },
        }),
    } as never);

    const result = await runRestrictedCustomCodeEdit(
      mockEditContext(dir),
      'Update phone',
      async () => false
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/verification failed/i);
    expect(result.verificationPassed).toBe(false);

    await fs.rm(dir, { recursive: true, force: true });
  });
});

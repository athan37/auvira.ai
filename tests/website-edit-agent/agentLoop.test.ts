import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';
import { runAgentLoop } from '../../src/lib/project-workspace/website-edit-agent/WebsiteEditAgent';

describe('WebsiteEditAgent loop (mocked LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes read → write → finish flow', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-agent-'));
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/app/globals.css'),
      'body { background: #fff; }',
      'utf-8'
    );
    await fs.writeFile(
      path.join(dir, 'src/app/page.tsx'),
      'const preset = { pageBg: "bg-white" };',
      'utf-8'
    );

    const mockLlm = {
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'read css',
            action: { tool: 'read_file', args: { path: 'src/app/globals.css' } },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'write blue page preset',
            action: {
              tool: 'write_file',
              args: {
                path: 'src/app/page.tsx',
                content:
                  'const preset = { pageBg: "bg-blue-600", heroBg: "bg-blue-600", surfaceBg: "bg-blue-50" };\nexport default function Home() { return <main className={preset.pageBg}>Hi</main>; }',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'done',
            action: {
              tool: 'finish',
              args: {
                summary: 'Updated styling',
                ownerMessage: 'Changed background to blue.',
              },
            },
          },
        }),
    };

    vi.mocked(getLLMClient).mockReturnValue(mockLlm as never);

    const result = await runAgentLoop({
      workspacePath: dir,
      ownerMessage: 'make background blue',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok).toBe(true);
    expect(result.changedFiles).toContain('src/app/page.tsx');
    const page = await fs.readFile(path.join(dir, 'src/app/page.tsx'), 'utf-8');
    expect(page).toContain('bg-blue-600');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('recovers when apply_patch fails and write_file succeeds', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-agent-patch-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      'export const siteConfig = { hero: { headline: "Old" } };',
      'utf-8'
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'patch headline',
            action: {
              tool: 'apply_patch',
              args: { patch: '--- a/src/lib/siteConfig.ts\n+++ b/src/lib/siteConfig.ts\n@@\n-bad\n+good' },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'write instead',
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: 'export const siteConfig = { hero: { headline: "New Headline" } };',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'done',
            action: {
              tool: 'finish',
              args: { summary: 'Updated headline', ownerMessage: 'Updated headline.' },
            },
          },
        }),
    } as never);

    const result = await runAgentLoop({
      workspacePath: dir,
      ownerMessage: 'update the hero headline',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok).toBe(true);
    const config = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(config).toContain('New Headline');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rejects finish until at least one file is written', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-agent-finish-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      'export const siteConfig = { hero: { headline: "Old" } };',
      'utf-8'
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'done too early',
            action: { tool: 'finish', args: { summary: 'Done', ownerMessage: 'Done.' } },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'write headline',
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: 'export const siteConfig = { hero: { headline: "Better Headline" } };',
              },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'finish',
            action: { tool: 'finish', args: { summary: 'Updated', ownerMessage: 'Updated headline.' } },
          },
        }),
    } as never);

    const result = await runAgentLoop({
      workspacePath: dir,
      ownerMessage: 'Change the hero headline',
      agentPrompt: 'OWNER REQUEST: Change the hero headline\nTASK: write_file before finish.',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok).toBe(true);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');

    await fs.rm(dir, { recursive: true, force: true });
  });
});

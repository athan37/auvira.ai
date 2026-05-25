import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';
import { runSingleShotStrategy } from '../../src/lib/project-workspace/website-edit-agent/singleShotStrategy';
import { runAgentLoop } from '../../src/lib/project-workspace/website-edit-agent/WebsiteEditAgent';
import { writeFileTool } from '../../src/lib/project-workspace/website-edit-agent/tools/writeFile';
import { computeWorkspaceHashes } from '../../src/lib/project-workspace/workspaceEditShared';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/minimal-next-site');

describe('parity: style edits (mocked LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('style-blue-background updates globals.css and page.tsx', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-parity-'));
    await fs.cp(FIXTURE, dir, { recursive: true });

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [
            {
              path: 'src/app/globals.css',
              content: 'body { background: #2563eb; color: #111; }',
            },
            {
              path: 'src/app/page.tsx',
              content:
                'const preset = { pageBg: "bg-[#2563eb]", surfaceBg: "bg-[#2563eb]" };\nexport default function Home() { return <main className={"min-h-screen " + preset.pageBg}>Hi</main>; }',
            },
          ],
          summary: 'Changed background to blue.',
        },
      }),
    } as never);

    const before = await computeWorkspaceHashes(dir);
    const result = await runSingleShotStrategy(
      {
        workspacePath: dir,
        ownerMessage: 'change to blue background',
        projectId: 'test',
        mode: 'gitlab',
      },
      before
    );

    expect(result?.ok).toBe(true);
    expect(result?.changedFiles).toContain('src/app/globals.css');
    expect(result?.changedFiles).toContain('src/app/page.tsx');

    const css = await fs.readFile(path.join(dir, 'src/app/globals.css'), 'utf-8');
    expect(css).toContain('#2563eb');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('style-green-background updates preset colors', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-parity-'));
    await fs.cp(FIXTURE, dir, { recursive: true });

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [
            { path: 'src/app/globals.css', content: 'body { background: #22c55e; }' },
            {
              path: 'src/app/page.tsx',
              content: 'const preset = { pageBg: "bg-[#22c55e]", surfaceBg: "bg-[#22c55e]" };',
            },
          ],
          summary: 'Green background applied.',
        },
      }),
    } as never);

    const before = await computeWorkspaceHashes(dir);
    const result = await runSingleShotStrategy(
      {
        workspacePath: dir,
        ownerMessage: 'make the background green',
        projectId: 'test',
        mode: 'gitlab',
      },
      before
    );

    expect(result?.ok).toBe(true);
    const css = await fs.readFile(path.join(dir, 'src/app/globals.css'), 'utf-8');
    expect(css).toContain('#22c55e');

    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('parity: agent loop (mocked LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copy-hero-headline updates siteConfig or page.tsx', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-parity-'));
    await fs.cp(FIXTURE, dir, { recursive: true });

    const newHeadline = 'We Build With Excellence';
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'read config',
            action: { tool: 'read_file', args: { path: 'src/lib/siteConfig.ts' } },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'update headline',
            action: {
              tool: 'write_file',
              args: {
                path: 'src/lib/siteConfig.ts',
                content: `export const siteConfig = { hero: { headline: "${newHeadline}" } };\n`,
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
              args: { summary: 'Updated hero headline.', ownerMessage: 'Updated hero headline.' },
            },
          },
        }),
    } as never);

    const result = await runAgentLoop({
      workspacePath: dir,
      ownerMessage: 'update the hero headline to We Build With Excellence',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const config = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(config).toContain(newHeadline);

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('section-why-choose-us grows page.tsx', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-parity-'));
    await fs.cp(FIXTURE, dir, { recursive: true });

    const expandedPage = `export default function Home() {
  return (
    <main>
      <section><h2>Why Choose Us</h2><p>Quality craftsmanship.</p></section>
    </main>
  );
}
`;

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'read page',
            action: { tool: 'read_file', args: { path: 'src/app/page.tsx' } },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'add section',
            action: {
              tool: 'write_file',
              args: { path: 'src/app/page.tsx', content: expandedPage },
            },
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            thought: 'done',
            action: {
              tool: 'finish',
              args: { summary: 'Added Why Choose Us section.', ownerMessage: 'Added section.' },
            },
          },
        }),
    } as never);

    const result = await runAgentLoop({
      workspacePath: dir,
      ownerMessage: 'add a Why Choose Us section',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    const page = await fs.readFile(path.join(dir, 'src/app/page.tsx'), 'utf-8');
    expect(page).toContain('Why Choose Us');

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('blocked-env rejects .env writes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-parity-'));
    const ctx = {
      workspacePath: dir,
      mode: 'gitlab' as const,
      ownerMessage: 'test',
      changedFiles: [] as string[],
      beforeFiles: {},
      afterFiles: {},
      recordChange: () => {},
    };
    const result = await writeFileTool({ path: '.env', content: 'API_KEY=secret' }, ctx);
    expect(result.ok).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });
});

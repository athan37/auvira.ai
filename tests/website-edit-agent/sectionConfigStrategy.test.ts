import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSectionConfigStrategy } from '../../src/lib/project-workspace/website-edit-agent/sectionConfigStrategy';
import { computeWorkspaceHashes } from '../../src/lib/project-workspace/workspaceEditShared';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';

const VALID_SITE_CONFIG = `export const siteConfig = {
  hero: { headline: "Welcome" },
  sections: [{ type: "testimonials", title: "Reviews", items: [] }],
};`;

describe('sectionConfigStrategy siteConfig safety', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = path.join(os.tmpdir(), `section-config-${Date.now()}-${Math.random()}`);
    await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      VALID_SITE_CONFIG,
      'utf-8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'src/app/page.tsx'),
      'export default function Page() { return null; }',
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(workspacePath, { recursive: true, force: true });
    vi.mocked(getLLMClient).mockReset();
  });

  it('does not write siteConfig when LLM output fails parse', async () => {
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: async () => ({
        ok: true,
        data: {
          files: [
            {
              path: 'src/lib/siteConfig.ts',
              content: `export const siteConfig = { sections: [{ title: "bad" quote }] };`,
            },
          ],
        },
      }),
    } as never);

    const beforeHashes = await computeWorkspaceHashes(workspacePath);
    const result = await runSectionConfigStrategy(
      {
        workspacePath,
        ownerMessage: 'add FAQ section',
        projectId: 'test',
        mode: 'gitlab',
      },
      beforeHashes
    );

    expect(result).toBeNull();
    const onDisk = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(onDisk).toBe(VALID_SITE_CONFIG);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';
import { runWebsiteEdit } from '../../src/lib/project-workspace/websiteEditRunner';

const WORKSPACE_ROOT = path.join(process.cwd(), '.tmp/git-workspaces');

describe('WEBSITE_AGENT_V2 flag', () => {
  const originalFlag = process.env.WEBSITE_AGENT_V2;

  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.WEBSITE_AGENT_V2;
    } else {
      process.env.WEBSITE_AGENT_V2 = originalFlag;
    }
  });

  it('routes runWebsiteEdit through V2 when enabled', async () => {
    const dir = await fs.mkdtemp(path.join(WORKSPACE_ROOT, 'v2-runner-'));
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: { phone: '555-0100' },
  sections: [],
};`,
      'utf-8'
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          planVersion: 'website-agent-v2',
          intent: 'contact',
          route: 'contact',
          confidence: 'high',
          steps: [{ skill: 'update_contact', args: { field: 'phone', value: '555-0199' } }],
          summary: 'Updated the phone number.',
        },
      }),
    } as never);

    process.env.WEBSITE_AGENT_V2 = 'true';
    const result = await runWebsiteEdit({
      workspacePath: dir,
      ownerMessage: 'Update phone number to 555-0199',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(result.ok, result.error).toBe(true);
    expect(result.agent).toBe('ts-v2');
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('555-0199');

    await fs.rm(dir, { recursive: true, force: true });
  });
});


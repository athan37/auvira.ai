import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';

describe('WEBSITE_AGENT_V3 flag', () => {
  const originalV3 = process.env.WEBSITE_AGENT_V3;
  const originalV2 = process.env.WEBSITE_AGENT_V2;

  beforeEach(() => {
    delete process.env.WEBSITE_AGENT_V2;
  });

  afterEach(() => {
    if (originalV3 === undefined) delete process.env.WEBSITE_AGENT_V3;
    else process.env.WEBSITE_AGENT_V3 = originalV3;
    if (originalV2 === undefined) delete process.env.WEBSITE_AGENT_V2;
    else process.env.WEBSITE_AGENT_V2 = originalV2;
  });

  it('routes to ts-v3 when flag is set', async () => {
    process.env.WEBSITE_AGENT_V3 = 'true';

    const result = await runWebsiteEdit({
      workspacePath: '/nonexistent-path-for-v3-flag-test',
      ownerMessage: 'test',
      projectId: 'flag-test',
      mode: 'gitlab',
    });

    expect(result.agent).toBe('ts-v3');
    expect(result.ok).toBe(false);
  });

  it('V3 takes precedence over V2', async () => {
    process.env.WEBSITE_AGENT_V3 = 'true';
    process.env.WEBSITE_AGENT_V2 = 'true';

    const result = await runWebsiteEdit({
      workspacePath: '/nonexistent-path-for-v3-flag-test',
      ownerMessage: 'test',
      projectId: 'flag-test',
      mode: 'gitlab',
    });

    expect(result.agent).toBe('ts-v3');
  });
});

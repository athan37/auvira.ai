import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveWebsiteEditAgentMode,
  runWebsiteEdit,
} from '@/lib/project-workspace/websiteEditRunner';

describe('website edit agent routing', () => {
  const originalV1 = process.env.WEBSITE_AGENT_V1;
  const originalV3 = process.env.WEBSITE_AGENT_V3;

  beforeEach(() => {
    delete process.env.WEBSITE_AGENT_V1;
    delete process.env.WEBSITE_AGENT_V3;
  });

  afterEach(() => {
    if (originalV1 === undefined) delete process.env.WEBSITE_AGENT_V1;
    else process.env.WEBSITE_AGENT_V1 = originalV1;
    if (originalV3 === undefined) delete process.env.WEBSITE_AGENT_V3;
    else process.env.WEBSITE_AGENT_V3 = originalV3;
  });

  it('defaults to ts-v3 for gitlab workspaces', () => {
    expect(resolveWebsiteEditAgentMode({ mode: 'gitlab' })).toBe('ts-v3');
  });

  it('uses legacy ts for static workspaces', () => {
    expect(resolveWebsiteEditAgentMode({ mode: 'static' })).toBe('ts');
  });

  it('routes to ts-v1 when WEBSITE_AGENT_V1=true', () => {
    process.env.WEBSITE_AGENT_V1 = 'true';
    expect(resolveWebsiteEditAgentMode({ mode: 'gitlab' })).toBe('ts');
  });

  it('runWebsiteEdit reports ts-v3 by default on gitlab', async () => {
    const result = await runWebsiteEdit({
      workspacePath: '/nonexistent-path-for-v3-default-test',
      ownerMessage: 'test',
      projectId: 'flag-test',
      mode: 'gitlab',
    });

    expect(result.agent).toBe('ts-v3');
    expect(result.ok).toBe(false);
  });
});

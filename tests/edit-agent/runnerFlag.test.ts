import { describe, it, expect } from 'vitest';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';

describe('website edit agent routing', () => {
  it('runWebsiteEdit always reports ts on gitlab', async () => {
    const result = await runWebsiteEdit({
      workspacePath: '/nonexistent-path-for-edit-agent-test',
      ownerMessage: 'test',
      projectId: 'flag-test',
      mode: 'gitlab',
    });

    expect(result.agent).toBe('ts');
    expect(result.ok).toBe(false);
  });
});

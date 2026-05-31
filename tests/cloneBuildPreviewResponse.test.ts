import { describe, expect, it } from 'vitest';
import { getClonePreviewProjectPath } from '@/lib/clone/cloneBuildPreviewResponse';

describe('getClonePreviewProjectPath', () => {
  it('returns the dynamic project editor path from build-preview response data', () => {
    const projectId = '6a1bc4fdc795e45980a08f4e';
    expect(getClonePreviewProjectPath({ projectId })).toBe(`/projects/${projectId}`);
  });

  it('returns null when auto-handoff did not produce a project id', () => {
    expect(getClonePreviewProjectPath({})).toBeNull();
    expect(getClonePreviewProjectPath({ projectId: '' })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { getChangedPathsFromHashes } from '../src/lib/project-workspace/workspaceDiff';

describe('workspaceDiff', () => {
  it('detects added, modified, and deleted files', () => {
    const before = { 'a.txt': 'hash1', 'b.txt': 'hash2' };
    const after = { 'a.txt': 'hash1-changed', 'c.txt': 'hash3' };
    const paths = getChangedPathsFromHashes(before, after);
    expect(paths).toContain('a.txt');
    expect(paths).toContain('b.txt');
    expect(paths).toContain('c.txt');
  });
});

import { describe, it, expect } from 'vitest';
import {
  isBlockedWorkspacePath,
  isSafeWritePath,
  resolveSafePath,
} from '../../src/lib/project-workspace/workspaceEditShared';
import path from 'path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/minimal-next-site');

describe('workspace path safety', () => {
  it('blocks .env paths', () => {
    expect(isBlockedWorkspacePath('.env')).toBe(true);
    expect(isSafeWritePath('.env')).toBe(false);
  });

  it('allows src/app/page.tsx', () => {
    expect(isSafeWritePath('src/app/page.tsx')).toBe(true);
    expect(isBlockedWorkspacePath('src/app/page.tsx')).toBe(false);
  });

  it('resolveSafePath stays inside workspace', () => {
    const resolved = resolveSafePath(FIXTURE, 'src/app/globals.css');
    expect(resolved).toContain('minimal-next-site');
    expect(resolveSafePath(FIXTURE, '../../../etc/passwd')).toBeNull();
  });
});

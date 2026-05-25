import { describe, it, expect } from 'vitest';
import { parseGitStatusPorcelain, expandPublishableChanges } from '../../src/lib/gitlab/publishWorkspace';

describe('parseGitStatusPorcelain', () => {
  it('maps untracked to create', () => {
    const changes = parseGitStatusPorcelain('?? src/lib/siteConfig.ts');
    expect(changes).toEqual([{ filePath: 'src/lib/siteConfig.ts', action: 'create' }]);
  });

  it('maps modified to update', () => {
    const changes = parseGitStatusPorcelain(' M src/app/page.tsx');
    expect(changes).toEqual([{ filePath: 'src/app/page.tsx', action: 'update' }]);
  });

  it('maps deleted to delete', () => {
    const changes = parseGitStatusPorcelain(' D src/app/old.tsx');
    expect(changes).toEqual([{ filePath: 'src/app/old.tsx', action: 'delete' }]);
  });

  it('skips blocked paths', () => {
    const changes = parseGitStatusPorcelain(' M .env\n M src/app/page.tsx');
    expect(changes).toEqual([{ filePath: 'src/app/page.tsx', action: 'update' }]);
  });

  it('keeps untracked directory paths for expansion', () => {
    const changes = parseGitStatusPorcelain(
      '?? public/uploads/\n?? public/uploads/logo-abc123.png'
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        { filePath: 'public/uploads', action: 'create' },
        { filePath: 'public/uploads/logo-abc123.png', action: 'create' },
      ])
    );
  });
});

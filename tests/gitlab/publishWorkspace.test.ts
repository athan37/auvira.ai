import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  buildWorkspaceCommitActions,
  parseGitStatusPorcelain,
  expandPublishableChanges,
} from '../../src/lib/gitlab/publishWorkspace';

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

describe('buildWorkspaceCommitActions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-sanitize-'));
    await fs.mkdir(path.join(tmpDir, 'src/app'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('strips invalid Next.js page exports before GitLab commit', async () => {
    const pagePath = path.join(tmpDir, 'src/app/page.tsx');
    await fs.writeFile(
      pagePath,
      'export default function Home() { return null; }\nexport const __siteAgentPageGallerySync = 1;\n',
      'utf-8'
    );

    const actions = await buildWorkspaceCommitActions(tmpDir, [
      { filePath: 'src/app/page.tsx', action: 'update' },
    ]);

    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action?.action).not.toBe('delete');
    if (action && action.action !== 'delete') {
      expect(action.content).not.toContain('__siteAgentPageGallerySync');
      expect(action.content).toContain('export default function Home');
    }
  });
});

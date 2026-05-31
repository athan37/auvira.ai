/**
 * End-to-end regression tests for owner image upload → save → deploy paths.
 * Run with: npx vitest run tests/image-upload-save-deploy.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  buildWorkspaceCommitActions,
  expandPublishableChanges,
  listPublishableWorkspaceFiles,
  parseGitStatusPorcelain,
} from '../src/lib/gitlab/publishWorkspace';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isSafePublishPath,
  isSafeWritePath,
} from '../src/lib/project-workspace/workspaceEditShared';
import { buildChangedFileDetails } from '../src/lib/project-workspace/workspaceDiff';
import { saveWorkspaceImages } from '../src/lib/project-workspace/workspaceAssets';
import type { WorkspaceAssetAttachment } from '../src/lib/project-workspace/workspaceAssetTypes';

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function createGitWorkspace(): Promise<string> {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'img-flow-'));
  execSync('git init -b main', { cwd: workspacePath, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: workspacePath, stdio: 'ignore' });
  execSync('git config user.name "Test User"', { cwd: workspacePath, stdio: 'ignore' });
  await fs.mkdir(path.join(workspacePath, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(workspacePath, 'src/app'), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, 'src/lib/siteConfig.ts'),
    'export const siteConfig = { hero: { headline: "Hello" }, sections: [] };',
    'utf-8'
  );
  await fs.writeFile(
    path.join(workspacePath, 'src/app/page.tsx'),
    'export default function Page() { return <main>Hello</main>; }',
    'utf-8'
  );
  execSync('git add -A && git commit -m "init"', { cwd: workspacePath, stdio: 'ignore' });
  return workspacePath;
}

describe('image upload save deploy flow', () => {
  it('allows publishing image paths but not bare upload directories', () => {
    expect(isSafePublishPath('public/uploads/logo-abc.png')).toBe(true);
    expect(isSafePublishPath('public/uploads')).toBe(false);
    expect(isSafePublishPath('public/uploads/')).toBe(false);
    expect(isSafeWritePath('public/uploads/logo-abc.png')).toBe(false);
    expect(isSafeWritePath('src/app/page.tsx')).toBe(true);
  });

  it('uploads images and detects them in workspace hashes', async () => {
    const workspacePath = await createGitWorkspace();
    try {
      const before = await computeWorkspaceHashes(workspacePath);
      const saved = await saveWorkspaceImages({
        workspacePath,
        mode: 'gitlab',
        projectId: 'proj_test',
        files: [{ name: 'team-photo.png', mimeType: 'image/png', buffer: PNG_BUFFER }],
      });

      await fs.writeFile(
        path.join(workspacePath, 'src/app/page.tsx'),
        'export default function Page() { return <main><img src="/uploads/x.png" /></main>; }',
        'utf-8'
      );

      const after = await computeWorkspaceHashes(workspacePath);
      const changed = getChangedFilesFromHashes(before, after);

      expect(saved[0].publicUrl).toMatch(/^\/uploads\/.+\.png$/);
      expect(changed).toContain(saved[0].path);
      expect(changed).toContain('src/app/page.tsx');
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('builds git save actions for mixed code + image changes without EISDIR', async () => {
    const workspacePath = await createGitWorkspace();
    try {
      const saved = await saveWorkspaceImages({
        workspacePath,
        mode: 'gitlab',
        projectId: 'proj_test',
        files: [{ name: 'hero.jpg', mimeType: 'image/png', buffer: PNG_BUFFER }],
      });
      await fs.writeFile(
        path.join(workspacePath, 'src/app/page.tsx'),
        `export default function Page() { return <img src="${saved[0].publicUrl}" />; }`,
        'utf-8'
      );

      const statusOutput = execSync('git status --porcelain', {
        cwd: workspacePath,
        encoding: 'utf-8',
      });

      const changes = await expandPublishableChanges(
        workspacePath,
        parseGitStatusPorcelain(statusOutput)
      );
      expect(changes.some((c) => c.filePath === saved[0].path)).toBe(true);
      expect(changes.some((c) => c.filePath === 'src/app/page.tsx')).toBe(true);
      expect(changes.some((c) => c.filePath === 'public/uploads')).toBe(false);

      const actions = await buildWorkspaceCommitActions(workspacePath, changes);
      const imageAction = actions.find((a) => a.file_path === saved[0].path);
      const pageAction = actions.find((a) => a.file_path === 'src/app/page.tsx');

      expect(imageAction).toMatchObject({ encoding: 'base64', action: 'create' });
      expect(pageAction).toMatchObject({ action: 'update' });
      expect(pageAction && 'encoding' in pageAction ? pageAction.encoding : undefined).toBeUndefined();
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('records image files as added in change details for the Changes tab', async () => {
    const workspacePath = await createGitWorkspace();
    try {
      const before = await computeWorkspaceHashes(workspacePath);
      const saved = await saveWorkspaceImages({
        workspacePath,
        mode: 'gitlab',
        projectId: 'proj_test',
        files: [{ name: 'gallery.png', mimeType: 'image/png', buffer: PNG_BUFFER }],
      });
      const after = await computeWorkspaceHashes(workspacePath);
      const details = await buildChangedFileDetails(workspacePath, before, after);

      const imageChange = details.find((d) => d.path === saved[0].path);
      expect(imageChange).toMatchObject({ status: 'added' });
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('includes uploaded images in force-sync file list', async () => {
    const workspacePath = await createGitWorkspace();
    try {
      await saveWorkspaceImages({
        workspacePath,
        mode: 'gitlab',
        projectId: 'proj_test',
        files: [{ name: 'logo.png', mimeType: 'image/png', buffer: PNG_BUFFER }],
      });

      const files = await listPublishableWorkspaceFiles(workspacePath);
      expect(files.some((f) => f.filePath.includes('public/uploads/') && f.filePath.endsWith('.png'))).toBe(
        true
      );
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });
});

describe('deploy polling with image changes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('still resolves production URL when deployment is ready', async () => {
    const { resolveProductionLiveUrl } = await import('../src/lib/vercel/resolveProductionLiveUrl');
    const liveUrl = resolveProductionLiveUrl('ready', {
      deploymentUrl: 'https://my-site-abc123.vercel.app',
      expectedProductionUrl: 'https://my-site.vercel.app',
      aliases: ['my-site-team.vercel.app'],
    });
    expect(liveUrl).toBe('https://my-site-team.vercel.app');
  });
});

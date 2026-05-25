import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import {
  runStaticImageGalleryStrategy,
  validateStaticGalleryFiles,
} from '../../src/lib/project-workspace/website-edit-agent/staticImageGalleryStrategy';
import type { WorkspaceAssetAttachment } from '../../src/lib/project-workspace/workspaceAssetTypes';

const SOURCE_FIXTURE = path.join(process.cwd(), 'tests/fixtures/workspaces/static-html');
let workspaceDir = '';

const attachments: WorkspaceAssetAttachment[] = [
  {
    id: '1',
    path: 'public/uploads/a.png',
    publicUrl: '/uploads/a.png',
    previewUrl: '/uploads/a.png',
    originalName: 'product-a.png',
    mimeType: 'image/png',
    size: 100,
  },
  {
    id: '2',
    path: 'public/uploads/b.png',
    publicUrl: '/uploads/b.png',
    previewUrl: '/uploads/b.png',
    originalName: 'product-b.png',
    mimeType: 'image/png',
    size: 100,
  },
];

describe('staticImageGalleryStrategy', () => {
  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'static-gallery-'));
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(
      path.join(workspaceDir, 'index.html'),
      readFileSync(path.join(SOURCE_FIXTURE, 'index.html'), 'utf8')
    );
    writeFileSync(
      path.join(workspaceDir, 'site.json'),
      readFileSync(path.join(SOURCE_FIXTURE, 'site.json'), 'utf8')
    );
  });

  afterEach(() => {
    if (workspaceDir) {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('patches index.html and site.json with gallery URLs', async () => {
    const beforeHashes = {
      'index.html': 'abc',
      'site.json': 'def',
    };
    const result = await runStaticImageGalleryStrategy(
      {
        workspacePath: workspaceDir,
        ownerMessage: 'add these product photos',
        projectId: 'test',
        mode: 'static',
        attachments,
      },
      beforeHashes
    );
    expect(result?.ok).toBe(true);

    const indexAfter = readFileSync(path.join(workspaceDir, 'index.html'), 'utf8');
    const siteJsonAfter = readFileSync(path.join(workspaceDir, 'site.json'), 'utf8');
    const check = validateStaticGalleryFiles(indexAfter, siteJsonAfter, attachments);
    expect(check.ok).toBe(true);
    expect(indexAfter).toContain('id="gallery"');
    expect(indexAfter).toContain('/uploads/a.png');
  });
});

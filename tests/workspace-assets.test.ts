/**
 * Run with: npx vitest run tests/workspace-assets.test.ts
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import {
  getWorkspaceUploadDir,
  saveWorkspaceImages,
} from '../src/lib/project-workspace/workspaceAssets';

describe('workspaceAssets', () => {
  it('stores gitlab uploads under public/uploads', () => {
    expect(getWorkspaceUploadDir('gitlab')).toBe('public/uploads');
  });

  it('saves image files to workspace', async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-assets-'));
  try {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      const saved = await saveWorkspaceImages({
        workspacePath,
        mode: 'gitlab',
        projectId: 'proj_test',
        files: [{ name: 'logo.png', mimeType: 'image/png', buffer: png }],
      });

      expect(saved).toHaveLength(1);
      expect(saved[0].publicUrl).toMatch(/^\/uploads\/.+\.png$/);
      await fs.access(path.join(workspacePath, saved[0].path));
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });
});

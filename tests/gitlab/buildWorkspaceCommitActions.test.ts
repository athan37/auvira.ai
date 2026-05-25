import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  buildWorkspaceCommitActions,
  expandPublishableChanges,
  parseGitStatusPorcelain,
} from '../../src/lib/gitlab/publishWorkspace';

describe('buildWorkspaceCommitActions', () => {
  it('skips directories and reads image files as base64', async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-ws-'));
    try {
      await fs.mkdir(path.join(workspacePath, 'public/uploads'), { recursive: true });
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      await fs.writeFile(path.join(workspacePath, 'public/uploads/logo.png'), png);

      const actions = await buildWorkspaceCommitActions(workspacePath, [
        { filePath: 'public/uploads', action: 'create' },
        { filePath: 'public/uploads/logo.png', action: 'create' },
      ]);

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        action: 'create',
        file_path: 'public/uploads/logo.png',
        encoding: 'base64',
      });
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('expands untracked public/ directory into image files', async () => {
    const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-ws-'));
    try {
      await fs.mkdir(path.join(workspacePath, 'public/uploads'), { recursive: true });
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      await fs.writeFile(path.join(workspacePath, 'public/uploads/logo.png'), png);

      const expanded = await expandPublishableChanges(workspacePath, [
        { filePath: 'public', action: 'create' },
      ]);

      expect(expanded).toEqual([
        { filePath: 'public/uploads/logo.png', action: 'create' },
      ]);
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });
});

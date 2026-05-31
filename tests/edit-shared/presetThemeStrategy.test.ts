import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { runPresetThemeStrategy } from '../../src/lib/project-workspace/edit-shared/strategies/presetThemeStrategy';
import { computeWorkspaceHashes } from '../../src/lib/project-workspace/workspaceEditShared';

const FIXTURE = path.join(
  process.cwd(),
  'tests/fixtures/workspaces/preset-theme'
);

describe('presetThemeStrategy', () => {
  it('swaps red to yellow in page.tsx preset', async () => {
    const workspacePath = path.join(os.tmpdir(), `preset-theme-${Date.now()}`);
    await fs.cp(FIXTURE, workspacePath, { recursive: true });

    const beforeHashes = await computeWorkspaceHashes(workspacePath);
    const result = await runPresetThemeStrategy(
      {
        workspacePath,
        ownerMessage: 'change background color from red to yellow throughout the site',
        projectId: 'test',
        mode: 'gitlab',
      },
      beforeHashes
    );

    expect(result?.ok).toBe(true);
    expect(result?.strategy).toBe('preset_theme');

    const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
    expect(page).toMatch(/bg-yellow/);
    expect(page).not.toMatch(/bg-red/);

    await fs.rm(workspacePath, { recursive: true, force: true });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  getGitWorkspacePath,
  getGitWorkspaceRepoDir,
  isGitWorkspaceUsable,
  removeGitWorkspace,
  workspaceExists,
} from '@/lib/project-workspace/gitWorkspaceManager';

describe('gitWorkspaceManager stale workspace', () => {
  const projectId = 'test-stale-workspace';
  let scratchRoot = '';

  beforeEach(async () => {
    scratchRoot = path.join(await fs.mkdtemp(path.join(process.cwd(), 'git-ws-test-')));
    process.env.SITE_AGENT_SCRATCH_DIR = scratchRoot;
  });

  afterEach(async () => {
    delete process.env.SITE_AGENT_SCRATCH_DIR;
    await fs.rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('detects corrupt workspace with only .next as unusable', async () => {
    const workspacePath = getGitWorkspacePath(projectId);
    await fs.mkdir(path.join(workspacePath, '.next'), { recursive: true });
    expect(await workspaceExists(projectId)).toBe(true);
    expect(await isGitWorkspaceUsable(projectId)).toBe(false);
  });

  it('removeGitWorkspace clears a corrupt partial directory', async () => {
    const workspacePath = getGitWorkspacePath(projectId);
    await fs.mkdir(path.join(workspacePath, '.next'), { recursive: true });
    await removeGitWorkspace(projectId);
    expect(await workspaceExists(projectId)).toBe(false);
    expect(await fs.stat(getGitWorkspaceRepoDir(projectId)).catch(() => null)).toBeNull();
  });
});

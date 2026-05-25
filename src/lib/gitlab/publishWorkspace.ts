import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { commitActionsToGitLab } from './commitFiles';
import { listGitLabRepositoryFilePaths } from './listRepositoryFiles';
import type { GitLabCommitAction } from './types';
import {
  computeWorkspaceHashes,
  isBlockedWorkspacePath,
  isSafePublishPath,
  WORKSPACE_BINARY_EXTENSIONS,
} from '../project-workspace/workspaceEditShared';

export interface WorkspaceFileChange {
  filePath: string;
  action: 'create' | 'update' | 'delete';
}

export interface PublishWorkspaceResult {
  commitSha: string;
  branch: string;
  published: boolean;
  changedFiles: string[];
}

/**
 * Parse `git status --porcelain` into file change intents.
 */
export function parseGitStatusPorcelain(statusOutput: string): WorkspaceFileChange[] {
  const changes: WorkspaceFileChange[] = [];

  for (const line of statusOutput.split('\n')) {
    if (!line.trim()) continue;

    const status = line.slice(0, 2);
    let filePath = line.slice(3).trim();
    if (!filePath) continue;
    filePath = filePath.replace(/\/+$/, '');
    if (!filePath) continue;

    // Rename: "old -> new" — publish the new path as update/create
    const renameArrow = filePath.indexOf(' -> ');
    if (renameArrow !== -1) {
      filePath = filePath.slice(renameArrow + 4).trim();
    }

    if (isBlockedWorkspacePath(filePath)) {
      continue;
    }

    const isUntracked = status === '??';
    if (!isUntracked && !isSafePublishPath(filePath)) {
      continue;
    }

    if (
      filePath.startsWith('.next/') ||
      filePath.startsWith('node_modules/') ||
      filePath.includes('/.git/')
    ) {
      continue;
    }

    if (status === '??') {
      changes.push({ filePath, action: 'create' });
    } else if (status.includes('D')) {
      changes.push({ filePath, action: 'delete' });
    } else {
      changes.push({ filePath, action: 'update' });
    }
  }

  return changes;
}

async function listPublishableFilesRecursive(
  workspacePath: string,
  relativeDir: string
): Promise<string[]> {
  const results: string[] = [];
  const absDir = path.join(workspacePath, relativeDir);

  async function walk(currentRel: string) {
    let entries;
    try {
      entries = await fs.readdir(path.join(workspacePath, currentRel), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const childRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(childRel);
      } else if (entry.isFile() && isSafePublishPath(childRel)) {
        results.push(childRel);
      }
    }
  }

  let stat;
  try {
    stat = await fs.stat(absDir);
  } catch {
    return results;
  }

  if (stat.isDirectory()) {
    await walk(relativeDir);
  } else if (stat.isFile() && isSafePublishPath(relativeDir)) {
    results.push(relativeDir);
  }

  return results;
}

/** Expand git directory entries (e.g. `?? public/`) into publishable files. */
export async function expandPublishableChanges(
  workspacePath: string,
  changes: WorkspaceFileChange[]
): Promise<WorkspaceFileChange[]> {
  const byPath = new Map<string, WorkspaceFileChange>();

  for (const change of changes) {
    if (change.action === 'delete') {
      if (isSafePublishPath(change.filePath)) {
        byPath.set(change.filePath, change);
      }
      continue;
    }

    const absPath = path.join(workspacePath, change.filePath);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const nested = await listPublishableFilesRecursive(workspacePath, change.filePath);
      for (const filePath of nested) {
        byPath.set(filePath, { filePath, action: change.action });
      }
      continue;
    }

    if (stat.isFile() && isSafePublishPath(change.filePath)) {
      byPath.set(change.filePath, change);
    }
  }

  return Array.from(byPath.values()).sort((a, b) => a.filePath.localeCompare(b.filePath));
}

/**
 * Build GitLab commit actions from local workspace git status.
 */
export async function buildWorkspaceCommitActions(
  workspacePath: string,
  changes: WorkspaceFileChange[]
): Promise<GitLabCommitAction[]> {
  const actions: GitLabCommitAction[] = [];

  for (const change of changes) {
    if (change.action === 'delete') {
      actions.push({ action: 'delete', file_path: change.filePath });
      continue;
    }

    const absPath = path.join(workspacePath, change.filePath);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      console.warn(`[publishWorkspace] skipping missing file: ${change.filePath}`);
      continue;
    }

    if (!stat.isFile()) {
      console.warn(`[publishWorkspace] skipping non-file path: ${change.filePath}`);
      continue;
    }

    const ext = path.extname(change.filePath).toLowerCase();
    if (WORKSPACE_BINARY_EXTENSIONS.has(ext)) {
      const buffer = await fs.readFile(absPath);
      actions.push({
        action: change.action,
        file_path: change.filePath,
        content: buffer.toString('base64'),
        encoding: 'base64',
      });
      continue;
    }

    const content = await fs.readFile(absPath, 'utf-8');
    actions.push({
      action: change.action,
      file_path: change.filePath,
      content,
    });
  }

  return actions;
}

/**
 * Publish local workspace changes to GitLab via REST API (uses GITLAB_TOKEN only).
 */
export async function publishWorkspaceToGitLab(input: {
  workspacePath: string;
  gitlabProjectId: number;
  commitMessage: string;
  branch?: string;
}): Promise<PublishWorkspaceResult> {
  const { workspacePath, gitlabProjectId, commitMessage } = input;

  const statusOutput = execSync('git status --porcelain --untracked-files=all', {
    cwd: workspacePath,
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();

  if (!statusOutput) {
    throw new Error('No changes to commit');
  }

  const branch =
    input.branch ||
    execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

  const changes = await expandPublishableChanges(
    workspacePath,
    parseGitStatusPorcelain(statusOutput)
  );
  if (changes.length === 0) {
    throw new Error('No publishable file changes (blocked paths only?)');
  }

  let actions = await buildWorkspaceCommitActions(workspacePath, changes);

  let commitResult;
  try {
    commitResult = await commitActionsToGitLab({
      projectId: gitlabProjectId,
      branch,
      commitMessage,
      actions,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Retry with update for files GitLab already has (create/update mismatch).
    if (msg.includes('400') || msg.includes('already exists')) {
      actions = actions.map((action) =>
        action.action === 'create' ? { ...action, action: 'update' as const } : action
      );
      commitResult = await commitActionsToGitLab({
        projectId: gitlabProjectId,
        branch,
        commitMessage,
        actions,
      });
    } else {
      throw error;
    }
  }

  const commitSha = commitResult.id || commitResult.short_id || '';
  if (!commitSha) {
    throw new Error('GitLab commit succeeded but no commit SHA was returned');
  }

  // Align local git state so the workspace is clean (no git push).
  try {
    execSync('git add -A', { cwd: workspacePath, timeout: 30000 });
    const stillDirty = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    if (stillDirty) {
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: workspacePath,
        timeout: 30000,
      });
    }
  } catch (e) {
    console.warn(`[publishWorkspace] local git cleanup after API commit: ${e}`);
  }

  return {
    commitSha,
    branch,
    published: true,
    changedFiles: changes.map((c) => c.filePath),
  };
}

/**
 * List all publishable source files in the workspace (for force sync).
 */
export async function listPublishableWorkspaceFiles(
  workspacePath: string
): Promise<WorkspaceFileChange[]> {
  const hashes = await computeWorkspaceHashes(workspacePath);
  return Object.keys(hashes)
    .filter((filePath) => isSafePublishPath(filePath) && !isBlockedWorkspacePath(filePath))
    .sort()
    .map((filePath) => ({ filePath, action: 'update' as const }));
}

/**
 * Force-sync the full local workspace tree to GitLab (all publishable source files).
 */
export async function forcePublishWorkspaceToGitLab(input: {
  workspacePath: string;
  gitlabProjectId: number;
  commitMessage: string;
  branch?: string;
}): Promise<PublishWorkspaceResult> {
  const { workspacePath, gitlabProjectId, commitMessage } = input;

  const branch =
    input.branch ||
    execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

  const changes = await listPublishableWorkspaceFiles(workspacePath);
  if (changes.length === 0) {
    throw new Error('No publishable files found in workspace');
  }

  const gitlabPaths = await listGitLabRepositoryFilePaths(gitlabProjectId, branch);
  const changesWithActions = changes.map((change) => ({
    ...change,
    action: gitlabPaths.has(change.filePath) ? ('update' as const) : ('create' as const),
  }));

  let actions = await buildWorkspaceCommitActions(workspacePath, changesWithActions);

  let commitResult;
  try {
    commitResult = await commitActionsToGitLab({
      projectId: gitlabProjectId,
      branch,
      commitMessage,
      actions,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('400') ||
      msg.includes("doesn't exist") ||
      msg.includes('already exists')
    ) {
      actions = actions.map((action) => {
        if (msg.includes("doesn't exist") && action.action === 'update') {
          return { ...action, action: 'create' as const };
        }
        if (msg.includes('already exists') && action.action === 'create') {
          return { ...action, action: 'update' as const };
        }
        return action;
      });
      commitResult = await commitActionsToGitLab({
        projectId: gitlabProjectId,
        branch,
        commitMessage,
        actions,
      });
    } else {
      throw error;
    }
  }

  const commitSha = commitResult.id || commitResult.short_id || '';
  if (!commitSha) {
    throw new Error('GitLab commit succeeded but no commit SHA was returned');
  }

  try {
    execSync('git add -A', { cwd: workspacePath, timeout: 30000 });
    const stillDirty = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    if (stillDirty) {
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: workspacePath,
        timeout: 30000,
      });
    }
  } catch (e) {
    console.warn(`[publishWorkspace] local git cleanup after force sync: ${e}`);
  }

  return {
    commitSha,
    branch,
    published: true,
    changedFiles: changesWithActions.map((c) => c.filePath),
  };
}

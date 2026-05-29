import path from 'path';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { commitActionsToGitLab } from '@/lib/gitlab/commitFiles';
import {
  parseGitStatusPorcelain,
  type PublishWorkspaceResult,
  type WorkspaceFileChange,
} from '@/lib/gitlab/publishWorkspace';
import type { GitLabCommitAction } from '@/lib/gitlab/types';
import {
  isBlockedWorkspacePath,
  isSafePublishPath,
  WORKSPACE_BINARY_EXTENSIONS,
} from '@/lib/project-workspace/workspaceEditShared';
import { sanitizeSourceForPublish } from '@/lib/site-manager/siteConfigAgentMarkers';
import { getProjectSandbox } from './sandboxClient';
import { SANDBOX_WORKDIR } from './types';

function sandboxAbsPath(relPath: string): string {
  const normalized = relPath.replace(/^\/+/, '');
  return path.posix.join(SANDBOX_WORKDIR, normalized);
}

async function sandboxGitOutput(projectId: string, args: string[]): Promise<string> {
  const sandbox = await getProjectSandbox(projectId);
  const result = await sandbox.runCommand({
    cmd: 'git',
    args,
    cwd: SANDBOX_WORKDIR,
  });
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    throw new Error(stderr.slice(-300) || `git ${args[0]} failed`);
  }
  return (await result.stdout()).trim();
}

async function sandboxFileIsFile(projectId: string, relPath: string): Promise<boolean> {
  const sandbox = await getProjectSandbox(projectId);
  try {
    const st = await sandbox.fs.stat(sandboxAbsPath(relPath));
    return st.isFile();
  } catch {
    return false;
  }
}

async function listSandboxPublishableFiles(
  projectId: string,
  relativeDir: string
): Promise<string[]> {
  const sandbox = await getProjectSandbox(projectId);
  const result = await sandbox.runCommand({
    cmd: 'sh',
    args: [
      '-c',
      `find ${relativeDir ? `"${relativeDir}"` : '.'} -type f 2>/dev/null | head -500`,
    ],
    cwd: SANDBOX_WORKDIR,
  });
  if (result.exitCode !== 0) return [];
  const stdout = await result.stdout();
  return stdout
    .split('\n')
    .map((f: string) => f.trim().replace(/^\.\//, ''))
    .filter((f: string) => f && isSafePublishPath(f) && !isBlockedWorkspacePath(f));
}

async function expandSandboxChanges(
  projectId: string,
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

    const isFile = await sandboxFileIsFile(projectId, change.filePath);
    if (!isFile) {
      const nested = await listSandboxPublishableFiles(projectId, change.filePath);
      for (const filePath of nested) {
        byPath.set(filePath, { filePath, action: change.action });
      }
      continue;
    }

    if (isSafePublishPath(change.filePath)) {
      byPath.set(change.filePath, change);
    }
  }

  return Array.from(byPath.values()).sort((a, b) => a.filePath.localeCompare(b.filePath));
}

async function buildSandboxCommitActions(
  projectId: string,
  changes: WorkspaceFileChange[]
): Promise<GitLabCommitAction[]> {
  const sandbox = await getProjectSandbox(projectId);
  const actions: GitLabCommitAction[] = [];

  for (const change of changes) {
    if (change.action === 'delete') {
      actions.push({ action: 'delete', file_path: change.filePath });
      continue;
    }

    const abs = sandboxAbsPath(change.filePath);
    let stat;
    try {
      stat = await sandbox.fs.stat(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const ext = path.posix.extname(change.filePath).toLowerCase();
    if (WORKSPACE_BINARY_EXTENSIONS.has(ext)) {
      const buffer = await sandbox.fs.readFile(abs);
      actions.push({
        action: change.action,
        file_path: change.filePath,
        content: buffer.toString('base64'),
        encoding: 'base64',
      });
      continue;
    }

    const raw = await sandbox.fs.readFile(abs, 'utf8');
    const content = sanitizeSourceForPublish(change.filePath, raw);
    actions.push({
      action: change.action,
      file_path: change.filePath,
      content,
    });
  }

  return actions;
}

/** Whether the sandbox repo has uncommitted changes. */
export async function sandboxHasUncommittedChanges(projectId: string): Promise<boolean> {
  try {
    const status = await sandboxGitOutput(projectId, [
      'status',
      '--porcelain',
      '--untracked-files=all',
    ]);
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Publish sandbox workspace changes to GitLab via REST API (reads files from sandbox VM).
 */
export async function publishSandboxWorkspaceToGitLab(input: {
  project: IWebsiteProject;
  projectId: string;
  commitMessage: string;
  branch?: string;
}): Promise<PublishWorkspaceResult> {
  const { project, projectId, commitMessage } = input;
  const gitlabProjectId = project.gitlab?.projectId;
  if (!gitlabProjectId) {
    throw new Error('No GitLab project linked');
  }

  const statusOutput = await sandboxGitOutput(projectId, [
    'status',
    '--porcelain',
    '--untracked-files=all',
  ]);
  if (!statusOutput) {
    throw new Error('No changes to commit');
  }

  const branch =
    input.branch ||
    (await sandboxGitOutput(projectId, ['rev-parse', '--abbrev-ref', 'HEAD']));

  const changes = await expandSandboxChanges(
    projectId,
    parseGitStatusPorcelain(statusOutput)
  );
  if (changes.length === 0) {
    throw new Error('No publishable file changes (blocked paths only?)');
  }

  let actions = await buildSandboxCommitActions(projectId, changes);

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

  const sandbox = await getProjectSandbox(projectId);
  await sandbox
    .runCommand({ cmd: 'git', args: ['add', '-A'], cwd: SANDBOX_WORKDIR })
    .catch(() => {});
  await sandbox
    .runCommand({ cmd: 'git', args: ['commit', '-m', commitMessage], cwd: SANDBOX_WORKDIR })
    .catch(() => {});

  return {
    commitSha,
    branch,
    published: true,
    changedFiles: changes.map((c) => c.filePath),
  };
}

/**
 * Manages GitLab-cloned workspaces for owner-facing editing.
 *
 * Path: .tmp/git-workspaces/{projectId}/repo
 *
 * For GitLab-mode projects, the actual cloned repo is used so the agent
 * can search/read/edit real source files. GitLab is updated on deploy via
 * GitLab REST API (GITLAB_TOKEN) — no local git push required.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { logProjectStep, safeError } from '@/lib/project-logs/projectLogger';

const GIT_WORKSPACE_BASE = '.tmp/git-workspaces';

export interface GitWorkspaceInfo {
  workspacePath: string;
  source: 'gitlab';
  branch: string;
  headSha: string;
  hasLocalChanges: boolean;
}

export function getGitWorkspacePath(projectId: string): string {
  return path.resolve(GIT_WORKSPACE_BASE, projectId, 'repo');
}

export function getGitWorkspaceRepoDir(projectId: string): string {
  return path.resolve(GIT_WORKSPACE_BASE, projectId);
}

export async function workspaceExists(projectId: string): Promise<boolean> {
  const workspacePath = getGitWorkspacePath(projectId);
  try {
    const stat = await fs.stat(workspacePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function getGitWorkspaceStatus(projectId: string): Promise<GitWorkspaceInfo | null> {
  const workspacePath = getGitWorkspacePath(projectId);
  const repoDir = getGitWorkspaceRepoDir(projectId);

  if (!(await workspaceExists(projectId))) {
    return null;
  }

  let branch = 'main';
  let headSha = '';
  let hasLocalChanges = false;

  try {
    // Get current branch
    const branchOutput = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    branch = branchOutput;

    // Get HEAD SHA
    const shaOutput = execSync('git rev-parse HEAD', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    headSha = shaOutput;

    // Check for local changes
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    hasLocalChanges = statusOutput.length > 0;
  } catch (e) {
    // git commands failed - not a valid git repo
    console.warn(`[workspace] ${projectId}: git status failed`, e);
  }

  return {
    workspacePath,
    source: 'gitlab',
    branch,
    headSha,
    hasLocalChanges,
  };
}

export async function ensureGitWorkspace(project: IWebsiteProject, userId?: string): Promise<GitWorkspaceInfo> {
  const projectId = project._id.toString();
  const repoDir = getGitWorkspaceRepoDir(projectId);
  const workspacePath = getGitWorkspacePath(projectId);

  await logProjectStep({
    projectId,
    userId: userId || 'unknown',
    runId: 'N/A',
    operation: 'workspace_ensure',
    step: 'workspace_ensure_started',
    status: 'started',
    level: 'info',
    message: `Ensuring git workspace for project ${projectId}`,
    metadata: { sourceUrl: project.sourceUrl },
  }).catch(() => {});

  if (await workspaceExists(projectId)) {
    // Reuse existing workspace
    const status = await getGitWorkspaceStatus(projectId);
    if (status) {
      console.log(`[workspace] source=gitlab path=${workspacePath} exists=true branch=${status.branch} hasLocalChanges=${status.hasLocalChanges}`);
      await logProjectStep({
        projectId,
        userId: userId || 'unknown',
        runId: 'N/A',
        operation: 'workspace_ensure',
        step: 'git_workspace_reused',
        status: 'success',
        level: 'info',
        message: `Git workspace reused: ${workspacePath}`,
        metadata: { branch: status.branch, hasLocalChanges: status.hasLocalChanges },
      }).catch(() => {});
      return status;
    }
  }

  // Need to clone
  if (!project.gitlab?.repoUrl) {
    await logProjectStep({
      projectId,
      userId: userId || 'unknown',
      runId: 'N/A',
      operation: 'workspace_ensure',
      step: 'workspace_ensure_failed',
      status: 'failed',
      level: 'error',
      message: `Project has no GitLab repo URL`,
    }).catch(() => {});
    throw new Error(`Project ${projectId} has no GitLab repo URL`);
  }

  const repoUrl = project.gitlab.repoUrl;
  const branch = project.gitlab.defaultBranch || 'main';

  console.log(`[workspace] Cloning ${repoUrl} (${branch}) into ${workspacePath}`);

  // Create parent directory
  await fs.mkdir(repoDir, { recursive: true });

  // Clone the repo
  try {
    await logProjectStep({
      projectId,
      userId: userId || 'unknown',
      runId: 'N/A',
      operation: 'workspace_ensure',
      step: 'git_workspace_cloning',
      status: 'started',
      level: 'info',
      message: `Cloning GitLab repo: ${repoUrl}`,
      metadata: { branch },
    }).catch(() => {});
    execSync(`git clone --branch ${branch} --single-branch ${repoUrl} "${workspacePath}"`, {
      cwd: repoDir,
      timeout: 120000,
      stdio: 'pipe',
    });
  } catch (e) {
    // Clean up on failure
    try {
      await fs.rm(repoDir, { recursive: true, force: true });
    } catch {}
    const errMsg = `Failed to clone ${repoUrl}: ${e instanceof Error ? e.message : 'Unknown error'}`;
    await logProjectStep({
      projectId,
      userId: userId || 'unknown',
      runId: 'N/A',
      operation: 'workspace_ensure',
      step: 'workspace_ensure_failed',
      status: 'failed',
      level: 'error',
      message: errMsg,
      error: safeError(e),
    }).catch(() => {});
    throw new Error(errMsg);
  }

  console.log(`[workspace] source=gitlab path=${workspacePath} cloned=true branch=${branch}`);
  await logProjectStep({
    projectId,
    userId: userId || 'unknown',
    runId: 'N/A',
    operation: 'workspace_ensure',
    step: 'git_workspace_cloned',
    status: 'success',
    level: 'info',
    message: `Git workspace cloned successfully`,
    metadata: { workspacePath, branch },
  }).catch(() => {});

  return {
    workspacePath,
    source: 'gitlab',
    branch,
    headSha: execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf-8', timeout: 10000 }).trim(),
    hasLocalChanges: false,
  };
}

export interface CommitAndPushResult {
  commitSha: string;
  branch: string;
  pushed: boolean;
}

/**
 * @deprecated Prefer {@link publishWorkspaceToGitLab} — uses GITLAB_TOKEN API, no git push.
 */
export async function commitAndPushWorkspace(
  projectId: string,
  summary: string
): Promise<CommitAndPushResult> {
  const workspacePath = getGitWorkspacePath(projectId);

  if (!(await workspaceExists(projectId))) {
    throw new Error(`Git workspace for project ${projectId} does not exist`);
  }

  // Stage all changes
  execSync('git add -A', { cwd: workspacePath, timeout: 30000 });

  // Check if there are changes to commit
  const statusOutput = execSync('git status --porcelain', {
    cwd: workspacePath,
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();

  if (!statusOutput) {
    throw new Error('No changes to commit');
  }

  // Get current branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();

  // Commit
  const commitMessage = summary || 'Website updates';
  execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
    cwd: workspacePath,
    timeout: 30000,
  });

  const commitSha = execSync('git rev-parse HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();

  // Push
  let pushed = false;
  try {
    execSync('git push origin HEAD', {
      cwd: workspacePath,
      timeout: 60000,
      stdio: 'pipe',
    });
    pushed = true;
  } catch (e) {
    console.warn(`[workspace] git push failed: ${e}`);
    // Non-fatal - Vercel may still pick up the commit
  }

  return { commitSha, branch, pushed };
}

export async function hasUncommittedChanges(projectId: string): Promise<boolean> {
  const workspacePath = getGitWorkspacePath(projectId);

  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    return statusOutput.length > 0;
  } catch {
    return false;
  }
}
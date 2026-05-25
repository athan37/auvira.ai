import { Sandbox } from '@vercel/sandbox';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { WebsiteProject } from '@/models/WebsiteProject';
import {
  SETUP_STAGE_LABELS,
  type WorkspaceSetupStage,
} from '@/lib/project-workspace/bootstrapProjectPreview';
import {
  checkPreviewUrlHealthy,
  waitForPreviewReady,
} from '@/lib/preview/waitForPreviewReady';

export { checkPreviewUrlHealthy };
import { logProjectStep } from '@/lib/project-logs/projectLogger';
import {
  buildAuthenticatedGitLabCloneUrl,
  cacheSandbox,
  defaultSandboxTimeoutMs,
  parseSandboxTimeout,
} from './sandboxClient';
import { sandboxNameForProject } from './sandboxNames';
import { SANDBOX_WORKDIR } from './types';

const BOOTSTRAP_LOCK_MAX_MS = 4 * 60 * 1000;
const sandboxBootstrapLocks = new Map<string, { promise: Promise<void>; startedAt: number }>();

async function setSetupStage(
  projectId: string,
  stage: WorkspaceSetupStage,
  extra?: Record<string, unknown>
) {
  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.setupStage': stage,
        'codeWorkspace.setupLabel': SETUP_STAGE_LABELS[stage],
        ...extra,
      },
    }
  );
}

async function sandboxCommandExists(sandbox: Sandbox, cmd: string): Promise<boolean> {
  const result = await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', `command -v ${cmd} >/dev/null 2>&1`],
    cwd: SANDBOX_WORKDIR,
  });
  return result.exitCode === 0;
}

async function ensureRipgrep(sandbox: Sandbox): Promise<void> {
  if (await sandboxCommandExists(sandbox, 'rg')) return;
  await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', 'command -v dnf >/dev/null && sudo dnf install -y ripgrep || npm install -g @vscode/ripgrep'],
    cwd: SANDBOX_WORKDIR,
  }).catch(() => {});
}

async function nodeModulesPresent(sandbox: Sandbox): Promise<boolean> {
  const result = await sandbox.runCommand({
    cmd: 'test',
    args: ['-d', 'node_modules'],
    cwd: SANDBOX_WORKDIR,
  });
  return result.exitCode === 0;
}

async function runNpmInstall(sandbox: Sandbox): Promise<void> {
  const result = await sandbox.runCommand({
    cmd: 'npm',
    args: ['install', '--legacy-peer-deps'],
    cwd: SANDBOX_WORKDIR,
  });
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    throw new Error(stderr.slice(-500) || `npm install failed (exit ${result.exitCode})`);
  }
}

async function startDevServerDetached(sandbox: Sandbox): Promise<void> {
  await sandbox.runCommand({
    cmd: 'npm',
    args: ['run', 'dev', '--', '-H', '0.0.0.0', '-p', '3000'],
    cwd: SANDBOX_WORKDIR,
    detached: true,
  });
}

async function waitForSandboxPreview(previewUrl: string): Promise<void> {
  try {
    await waitForPreviewReady(previewUrl, { timeoutMs: 120_000, intervalMs: 1500 });
  } catch {
    const healthy = await checkPreviewUrlHealthy(previewUrl, 15_000);
    if (!healthy) {
      throw new Error(`Sandbox preview at ${previewUrl} did not become healthy`);
    }
  }
}

async function resumeSandboxDevServer(
  project: IWebsiteProject,
  sandbox: Sandbox,
  projectId: string
): Promise<string> {
  if (!(await nodeModulesPresent(sandbox))) {
    await setSetupStage(projectId, 'installing', {
      'codeWorkspace.status': 'setting_up',
      'preview.status': 'building',
    });
    await runNpmInstall(sandbox);
  }

  await setSetupStage(projectId, 'starting_server', {
    'codeWorkspace.status': 'setting_up',
    'preview.status': 'building',
  });

  const previewUrl = sandbox.domain(3000);
  const healthy = await checkPreviewUrlHealthy(previewUrl, 5000);
  if (!healthy) {
    await startDevServerDetached(sandbox);
    await waitForSandboxPreview(previewUrl);
  }

  return previewUrl;
}

async function bootstrapSandboxInner(project: IWebsiteProject, userId: string): Promise<void> {
  const projectId = project._id.toString();
  const branch = project.gitlab?.defaultBranch || 'main';
  const httpUrl = project.gitlab?.httpUrlToRepo?.trim();
  if (!httpUrl) {
    throw new Error('Project has no GitLab repository URL');
  }

  const authCloneUrl = buildAuthenticatedGitLabCloneUrl(httpUrl);
  const sandboxName = sandboxNameForProject(projectId);
  const timeoutMs = defaultSandboxTimeoutMs();

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.status': 'setting_up',
        'codeWorkspace.source': 'gitlab',
        'codeWorkspace.setupStage': 'cloning',
        'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.cloning,
        'preview.status': 'building',
      },
      $unset: { 'codeWorkspace.setupError': '', 'preview.error': '' },
    }
  );

  await logProjectStep({
    projectId,
    userId,
    runId: 'N/A',
    operation: 'workspace_ensure',
    step: 'sandbox_get_or_create',
    status: 'started',
    level: 'info',
    message: 'Starting Vercel Sandbox for project preview',
    metadata: { sandboxName },
  }).catch(() => {});

  const sandbox = await Sandbox.getOrCreate({
    name: sandboxName,
    timeout: timeoutMs,
    runtime: 'node24',
    ports: [3000],
    persistent: true,
    onCreate: async (sbx: Sandbox) => {
      const cloneResult = await sbx.runCommand({
        cmd: 'git',
        args: ['clone', '--branch', branch, '--single-branch', authCloneUrl, '.'],
        cwd: SANDBOX_WORKDIR,
      });
      if (cloneResult.exitCode !== 0) {
        const stderr = await cloneResult.stderr();
        throw new Error(stderr.slice(-500) || 'git clone failed');
      }

      await setSetupStage(projectId, 'installing');
      await runNpmInstall(sbx);
      await ensureRipgrep(sbx);
    },
    onResume: async (sbx: Sandbox) => {
      await resumeSandboxDevServer(project, sbx, projectId);
    },
  });

  cacheSandbox(projectId, sandbox);

  const previewUrl = await resumeSandboxDevServer(project, sandbox, projectId);
  const expiresAt = new Date(Date.now() + timeoutMs);

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'preview.status': 'ready',
        'preview.url': previewUrl,
        'preview.port': 3000,
        'preview.workspacePath': SANDBOX_WORKDIR,
        'preview.previewMode': 'sandbox',
        'preview.sandboxId': sandboxName,
        'preview.sandboxExpiresAt': expiresAt,
        'preview.startedAt': new Date(),
        'codeWorkspace.status': 'ready',
        'codeWorkspace.workspacePath': SANDBOX_WORKDIR,
        'codeWorkspace.branch': branch,
        'codeWorkspace.source': 'gitlab',
        'codeWorkspace.sandboxWorkspace': true,
        'codeWorkspace.setupStage': 'ready',
        'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.ready,
      },
      $unset: { 'codeWorkspace.setupError': '', 'preview.error': '' },
    }
  );

  await logProjectStep({
    projectId,
    userId,
    runId: 'N/A',
    operation: 'workspace_ensure',
    step: 'sandbox_ready',
    status: 'success',
    level: 'info',
    message: 'Sandbox preview ready',
    metadata: { previewUrl, sandboxName },
  }).catch(() => {});
}

/**
 * Bootstrap GitLab repo + next dev inside a Vercel Sandbox VM.
 */
export async function bootstrapProjectSandbox(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  const projectId = project._id.toString();

  if (
    project.preview?.previewMode === 'sandbox' &&
    project.preview.status === 'ready' &&
    project.preview.url
  ) {
    const healthy = await checkPreviewUrlHealthy(project.preview.url);
    if (healthy) {
      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            'codeWorkspace.status': 'ready',
            'codeWorkspace.sandboxWorkspace': true,
            'codeWorkspace.setupStage': 'ready',
          },
        }
      );
      return;
    }
  }

  const existing = sandboxBootstrapLocks.get(projectId);
  if (existing) {
    const lockAge = Date.now() - existing.startedAt;
    if (lockAge < BOOTSTRAP_LOCK_MAX_MS) {
      await existing.promise;
      return;
    }
    sandboxBootstrapLocks.delete(projectId);
  }

  const task = bootstrapSandboxInner(project, userId).catch(async (error) => {
    const errMsg = error instanceof Error ? error.message : 'Sandbox setup failed';
    const liveUrl = project.deployment?.liveUrl?.trim();

    await logProjectStep({
      projectId,
      userId,
      runId: 'N/A',
      operation: 'workspace_ensure',
      step: 'sandbox_failed',
      status: 'failed',
      level: 'error',
      message: errMsg,
    }).catch(() => {});

    if (liveUrl) {
      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            'preview.status': 'ready',
            'preview.url': liveUrl,
            'preview.previewMode': 'live',
            'preview.error': errMsg,
            'codeWorkspace.setupError': errMsg,
            'codeWorkspace.setupStage': 'ready',
            'codeWorkspace.setupLabel': 'Live site (sandbox failed — edits may not work)',
            'codeWorkspace.sandboxWorkspace': false,
          },
        }
      );
      return;
    }

    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          'codeWorkspace.status': 'failed',
          'codeWorkspace.setupStage': 'failed',
          'codeWorkspace.setupError': errMsg,
          'preview.status': 'failed',
          'preview.error': errMsg,
        },
      }
    );
    throw error;
  });

  const wrapped = { promise: task, startedAt: Date.now() };
  sandboxBootstrapLocks.set(projectId, wrapped);
  try {
    await task;
  } finally {
    if (sandboxBootstrapLocks.get(projectId) === wrapped) {
      sandboxBootstrapLocks.delete(projectId);
    }
  }
}

/** Lightweight ensure sandbox is available for edits (resume dev server if needed). */
export async function ensureProjectSandboxForEdit(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  if (project.preview?.previewMode === 'sandbox' && project.preview.url) {
    const healthy = await checkPreviewUrlHealthy(project.preview.url, 5000);
    if (healthy && project.codeWorkspace?.sandboxWorkspace) return;
  }
  await bootstrapProjectSandbox(project, userId);
}

export { parseSandboxTimeout };

import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { WebsiteProject } from '@/models/WebsiteProject';
import {
  ensureGitWorkspace,
  getGitWorkspacePath,
} from '@/lib/project-workspace/gitWorkspaceManager';
import { waitForPreviewReady } from '@/lib/preview/waitForPreviewReady';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';

export type WorkspaceSetupStage =
  | 'idle'
  | 'cloning'
  | 'installing'
  | 'starting_server'
  | 'ready'
  | 'failed';

export const SETUP_STAGE_LABELS: Record<WorkspaceSetupStage, string> = {
  idle: 'Preparing workspace…',
  cloning: 'Cloning your site from GitLab…',
  installing: 'Installing dependencies (first open may take a few minutes)…',
  starting_server: 'Starting preview server…',
  ready: 'Preview ready',
  failed: 'Workspace setup failed',
};

const BOOTSTRAP_LOCK_MAX_MS = 4 * 60 * 1000;
const bootstrapLocks = new Map<string, { promise: Promise<void>; startedAt: number }>();

function allocatePort(): number {
  return 3001 + Math.floor(Math.random() * 1000);
}

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

/** Returns false if the dev server does not respond (stale/hung process). */
export async function checkPreviewHealthy(port: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://127.0.0.1:${port}`, (res: { statusCode?: number }) => {
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function runNpmInstall(cwd: string, timeoutMs = 10 * 60 * 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const npmPath = getNpmPath();
    const child = spawn(npmPath, ['install'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' },
    });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`npm install timed out after ${Math.round(timeoutMs / 60000)} minutes`));
    }, timeoutMs);
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-500) || `npm install exited with code ${code}`));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function startDevServer(workspacePath: string, port: number) {
  const npmPath = getNpmPath();
  const args = ['run', 'dev', '--', '-H', '0.0.0.0', '-p', String(port)];
  const child = spawn(npmPath, args, {
    cwd: workspacePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: false,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  return child;
}

async function bootstrapGitlabProject(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  const projectId = project._id.toString();

  if (project.preview?.port) {
    const healthy = await checkPreviewHealthy(project.preview.port);
    if (healthy && project.preview.status === 'ready') {
      await WebsiteProject.updateOne(
        { _id: projectId },
        {
          $set: {
            'codeWorkspace.status': 'ready',
            'codeWorkspace.source': 'gitlab',
            'codeWorkspace.workspacePath': getGitWorkspacePath(projectId),
            'codeWorkspace.setupStage': 'ready',
            'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.ready,
          },
        }
      );
      return;
    }
    if (!healthy) {
      console.warn(
        `[bootstrap] Stale preview on port ${project.preview.port} for ${projectId} — restarting`
      );
      await stopPreviewServerByPort(project.preview.port);
    }
  }

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

  const gitInfo = await ensureGitWorkspace(project, userId);
  const workspacePath = gitInfo.workspacePath;

  const nodeModulesPath = join(workspacePath, 'node_modules');
  const needsInstall = !existsSync(nodeModulesPath);

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.status': 'ready',
        'codeWorkspace.workspacePath': workspacePath,
        'codeWorkspace.branch': gitInfo.branch,
        'codeWorkspace.headSha': gitInfo.headSha,
        'codeWorkspace.source': 'gitlab',
        'codeWorkspace.version': project.codeWorkspace?.version || 1,
        'codeWorkspace.setupStage': needsInstall ? 'installing' : 'starting_server',
        'codeWorkspace.setupLabel': needsInstall
          ? SETUP_STAGE_LABELS.installing
          : SETUP_STAGE_LABELS.starting_server,
      },
    }
  );

  if (needsInstall) {
    await runNpmInstall(workspacePath);
  }

  await setSetupStage(projectId, 'starting_server', {
    'codeWorkspace.status': 'setting_up',
    'preview.status': 'building',
  });

  const port = allocatePort();
  const devProcess = startDevServer(workspacePath, port);

  let stderrData = '';
  devProcess.stderr?.on('data', (chunk: Buffer) => {
    stderrData += chunk.toString();
  });

  await new Promise((r) => setTimeout(r, 5000));

  if (devProcess.exitCode !== null) {
    throw new Error(
      `Preview server exited with code ${devProcess.exitCode}. ${stderrData.slice(-300)}`
    );
  }

  devProcess.stdout?.removeAllListeners();
  devProcess.stderr?.removeAllListeners();
  devProcess.unref();

  const previewUrl = `http://127.0.0.1:${port}`;
  await waitForPreviewReady(previewUrl, { timeoutMs: 120_000, intervalMs: 1500 });

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'preview.status': 'ready',
        'preview.url': previewUrl,
        'preview.port': port,
        'preview.workspacePath': workspacePath,
        'preview.startedAt': new Date(),
        'codeWorkspace.status': 'ready',
        'codeWorkspace.setupStage': 'ready',
        'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.ready,
      },
    }
  );
}

/**
 * Ensure GitLab workspace + dev preview server for owner project page.
 */
/**
 * On Vercel serverless: no local `next dev` preview. Show published live URL; clone repo to /tmp for edits.
 */
async function bootstrapProjectPreviewHosted(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  const projectId = project._id.toString();
  const liveUrl = project.deployment?.liveUrl?.trim();

  if (!liveUrl) {
    throw new Error(
      'No live site URL yet. Publish your website first, then reopen this project.'
    );
  }

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.status': 'setting_up',
        'codeWorkspace.setupStage': 'cloning',
        'codeWorkspace.setupLabel': 'Preparing workspace for edits…',
        'preview.status': 'building',
      },
    }
  );

  try {
    const gitInfo = await ensureGitWorkspace(project, userId);
    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          'codeWorkspace.status': 'ready',
          'codeWorkspace.workspacePath': gitInfo.workspacePath,
          'codeWorkspace.branch': gitInfo.branch,
          'codeWorkspace.headSha': gitInfo.headSha,
          'codeWorkspace.source': 'gitlab',
          'codeWorkspace.setupStage': 'ready',
          'codeWorkspace.setupLabel': 'Showing published live site',
          'preview.status': 'ready',
          'preview.url': liveUrl,
          'preview.previewMode': 'live',
          'preview.startedAt': new Date(),
        },
        $unset: { 'preview.port': '', 'codeWorkspace.setupError': '', 'preview.error': '' },
      }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Workspace setup failed';
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
          'codeWorkspace.setupLabel': 'Live site (workspace clone failed — edits may not work)',
        },
      }
    );
  }
}

export async function bootstrapProjectPreview(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  const projectId = project._id.toString();

  if (!project.gitlab?.projectId) {
    throw new Error('This project has no GitLab repository. Save the clone preview first.');
  }

  if (isVercelServerless()) {
    await bootstrapProjectPreviewHosted(project, userId);
    return;
  }

  const existing = bootstrapLocks.get(projectId);
  if (existing) {
    const lockAge = Date.now() - existing.startedAt;
    if (lockAge < BOOTSTRAP_LOCK_MAX_MS) {
      await existing.promise;
      return;
    }
    console.warn(
      `[bootstrap] Replacing stale lock for ${projectId} (held ${Math.round(lockAge / 1000)}s)`
    );
    bootstrapLocks.delete(projectId);
  }

  const task = bootstrapGitlabProject(project, userId).catch(async (error) => {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await WebsiteProject.updateOne(
      { _id: projectId },
      {
        $set: {
          'codeWorkspace.status': 'failed',
          'codeWorkspace.setupStage': 'failed',
          'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.failed,
          'codeWorkspace.setupError': errMsg,
          'preview.status': 'failed',
          'preview.error': errMsg,
        },
      }
    );
    throw error;
  });

  const wrapped = { promise: task, startedAt: Date.now() };
  bootstrapLocks.set(projectId, wrapped);
  try {
    await task;
  } finally {
    if (bootstrapLocks.get(projectId) === wrapped) {
      bootstrapLocks.delete(projectId);
    }
  }
}

export function getWorkspaceStatusFromProject(project: IWebsiteProject) {
  const previewMode =
    (project.preview as { previewMode?: string } | undefined)?.previewMode === 'live'
      ? ('live' as const)
      : ('workspace' as const);
  const liveUrl = project.preview?.url || project.deployment?.liveUrl || null;

  if (previewMode === 'live' && project.preview?.status === 'ready' && liveUrl) {
    return {
      stage: 'ready' as const,
      label: SETUP_STAGE_LABELS.ready,
      previewStatus: 'ready',
      codeWorkspaceStatus: project.codeWorkspace?.status || 'ready',
      ready: true,
      error: project.preview?.error || project.codeWorkspace?.setupError || null,
      previewPort: null,
      previewMode: 'live' as const,
      liveUrl,
      previewHealthy: true,
    };
  }

  let stage = (project.codeWorkspace?.setupStage as WorkspaceSetupStage) || 'idle';
  const previewReady = project.preview?.status === 'ready' && !!project.preview?.port;
  const workspaceReady = project.codeWorkspace?.status === 'ready';
  const ready = previewReady && workspaceReady;

  if (!ready && workspaceReady && (stage === 'cloning' || stage === 'idle')) {
    stage =
      project.preview?.status === 'building' || project.preview?.port
        ? 'starting_server'
        : stage;
  }

  return {
    stage: ready ? ('ready' as const) : stage,
    label: ready
      ? SETUP_STAGE_LABELS.ready
      : SETUP_STAGE_LABELS[stage] || project.codeWorkspace?.setupLabel || SETUP_STAGE_LABELS.idle,
    previewStatus: project.preview?.status || 'not_started',
    codeWorkspaceStatus: project.codeWorkspace?.status || 'not_started',
    ready,
    error: project.codeWorkspace?.setupError || project.preview?.error || null,
    previewPort: project.preview?.port || null,
    previewMode: 'workspace' as const,
    liveUrl: project.deployment?.liveUrl || null,
    previewHealthy: ready,
  };
}

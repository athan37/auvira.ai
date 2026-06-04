import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { WebsiteProject } from '@/models/WebsiteProject';
import {
  ensureGitWorkspace,
  getGitWorkspacePath,
} from '@/lib/project-workspace/gitWorkspaceManager';
import { repairPreviewWorkspace } from '@/lib/preview/repairPreviewWorkspace';
import { startWorkspaceDevServer } from '@/lib/preview/startWorkspaceDevServer';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';
import {
  checkWorkspacePreviewHealthy,
  checkWorkspacePreviewChunksReady,
  fetchPreviewHtml,
  isReservedWorkspacePreviewPort,
} from '@/lib/preview/workspacePreviewHealth';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';

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

/**
 * Same health probe the preview proxy uses: HTTP + workspace HTML/chunk checks.
 * Keeps status/bootstrap "ready" in sync with what the iframe proxy can serve.
 */
export async function checkProjectWorkspacePreviewHealthy(
  project: IWebsiteProject
): Promise<boolean> {
  const port = project.preview?.port;
  if (!port || project.preview?.status !== 'ready') {
    return false;
  }
  if (isReservedWorkspacePreviewPort(port)) {
    return false;
  }
  const workspacePath =
    project.preview?.workspacePath?.trim() || getGitWorkspacePath(project._id.toString());
  return checkWorkspacePreviewHealthy(port, workspacePath);
}

/** Returns false if the dev server does not respond (stale/hung process). */
export async function checkPreviewHealthy(port: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://127.0.0.1:${port}`, (res: { statusCode?: number }) => {
      const code = res.statusCode ?? 0;
      resolve((code >= 200 && code < 400) || code === 307 || code === 308);
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

async function bootstrapGitlabProject(
  project: IWebsiteProject,
  userId: string
): Promise<void> {
  const projectId = project._id.toString();

  const workspacePath = getGitWorkspacePath(projectId);

  if (project.preview?.port) {
    const port = project.preview.port;
    const portOk = !isReservedWorkspacePreviewPort(port);
    const healthy =
      portOk && (await checkWorkspacePreviewHealthy(port, workspacePath));
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
            'preview.previewMode': 'workspace',
            'codeWorkspace.sandboxWorkspace': false,
          },
        }
      );
      return;
    }
    if (!healthy) {
      const reason = !portOk
        ? 'port is reserved for Site Agent app'
        : 'preview does not match workspace';
      console.warn(
        `[bootstrap] Stale preview on port ${port} for ${projectId} (${reason}) — restarting`
      );
      if (portOk) {
        await stopPreviewServerByPort(port);
      }
      await WebsiteProject.updateOne(
        { _id: projectId },
        { $unset: { 'preview.port': '', 'preview.url': '' } }
      );
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
  const resolvedWorkspacePath = gitInfo.workspacePath;

  await repairPreviewWorkspace(resolvedWorkspacePath);

  const nodeModulesPath = join(resolvedWorkspacePath, 'node_modules');
  const needsInstall = !existsSync(nodeModulesPath);

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'codeWorkspace.status': 'ready',
        'codeWorkspace.workspacePath': resolvedWorkspacePath,
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
    await runNpmInstall(resolvedWorkspacePath);
  }

  await setSetupStage(projectId, 'starting_server', {
    'codeWorkspace.status': 'setting_up',
    'preview.status': 'building',
  });

  const port = allocatePort();
  const previewUrl = `http://127.0.0.1:${port}`;
  await startWorkspaceDevServer(resolvedWorkspacePath, port, { timeoutMs: 180_000 });

  const chunkDeadline = Date.now() + 60_000;
  let chunksReady = false;
  while (Date.now() < chunkDeadline) {
    const html = await fetchPreviewHtml(port, 8000);
    if (html && (await checkWorkspacePreviewChunksReady(port, html, 8000))) {
      chunksReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!chunksReady) {
    console.warn(`[bootstrap] Preview chunks not ready within 60s for ${projectId}`);
  }

  await WebsiteProject.updateOne(
    { _id: projectId },
    {
      $set: {
        'preview.status': 'ready',
        'preview.url': previewUrl,
        'preview.port': port,
        'preview.workspacePath': resolvedWorkspacePath,
        'preview.previewMode': 'workspace',
        'preview.startedAt': new Date(),
        'codeWorkspace.status': 'ready',
        'codeWorkspace.setupStage': 'ready',
        'codeWorkspace.setupLabel': SETUP_STAGE_LABELS.ready,
        'codeWorkspace.sandboxWorkspace': false,
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
    if (isSandboxPreviewEnabled()) {
      const { bootstrapProjectSandbox } = await import('@/lib/sandbox/bootstrapProjectSandbox');
      await bootstrapProjectSandbox(project, userId);
    } else {
      await bootstrapProjectPreviewHosted(project, userId);
    }
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

function getLocalWorkspaceStatus(project: IWebsiteProject) {
  const deploymentLiveUrl = project.deployment?.liveUrl || null;
  const previewPort = project.preview?.port ?? null;
  const previewPortInvalid =
    previewPort != null && isReservedWorkspacePreviewPort(previewPort);
  let stage = (project.codeWorkspace?.setupStage as WorkspaceSetupStage) || 'idle';
  const previewReady =
    project.preview?.status === 'ready' && !!previewPort && !previewPortInvalid;
  const workspaceReady = project.codeWorkspace?.status === 'ready';
  const ready = previewReady && workspaceReady;

  if (!ready && workspaceReady && (stage === 'cloning' || stage === 'idle')) {
    stage =
      project.preview?.status === 'building' || previewPort
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
    previewPort,
    previewMode: 'workspace' as const,
    liveUrl: deploymentLiveUrl,
    previewHealthy: ready,
  };
}

/**
 * Map Mongo project fields to workspace/preview UI status.
 * Local dev always uses editable workspace preview (next dev + proxy), never production live URL.
 */
export function getWorkspaceStatusFromProject(project: IWebsiteProject) {
  if (!isVercelServerless()) {
    return getLocalWorkspaceStatus(project);
  }

  const rawMode = (project.preview as { previewMode?: string } | undefined)?.previewMode;
  const previewMode =
    rawMode === 'live' ? ('live' as const) : rawMode === 'sandbox' ? ('sandbox' as const) : ('workspace' as const);
  const liveUrl = project.deployment?.liveUrl || null;
  const previewUrl = project.preview?.url || null;

  if (previewMode === 'sandbox' && project.preview?.status === 'ready' && previewUrl) {
    return {
      stage: 'ready' as const,
      label: 'Dev preview',
      previewStatus: 'ready',
      codeWorkspaceStatus: project.codeWorkspace?.status || 'ready',
      ready: true,
      error: project.preview?.error || project.codeWorkspace?.setupError || null,
      previewPort: null,
      previewMode: 'sandbox' as const,
      liveUrl: previewUrl,
      previewHealthy: true,
    };
  }

  if (previewMode === 'live' && project.preview?.status === 'ready' && (previewUrl || liveUrl)) {
    return {
      stage: 'ready' as const,
      label: SETUP_STAGE_LABELS.ready,
      previewStatus: 'ready',
      codeWorkspaceStatus: project.codeWorkspace?.status || 'ready',
      ready: true,
      error: project.preview?.error || project.codeWorkspace?.setupError || null,
      previewPort: null,
      previewMode: 'live' as const,
      liveUrl: previewUrl || liveUrl,
      previewHealthy: true,
    };
  }

  return getLocalWorkspaceStatus(project);
}

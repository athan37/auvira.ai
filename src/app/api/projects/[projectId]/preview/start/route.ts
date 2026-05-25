import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { waitForPreviewReady } from '@/lib/preview/waitForPreviewReady';
import { stopPreviewServerByPort } from '@/lib/preview/stopPreviewServer';
import { ensurePreviewRuntime, workspacePathForProject } from '@/lib/preview/ensurePreviewRuntime';
import { existsSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'fs';
import { join } from 'path';
import { scratchPath } from '@/lib/runtime/scratchDir';

export const runtime = 'nodejs';

function writeFilesToDisk(files: Array<{ filePath: string; content: string }>, workspacePath: string) {
  for (const file of files) {
    const filePath = join(workspacePath, file.filePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, file.content, 'utf-8');
  }
}

function allocatePort(): number {
  return 3001 + Math.floor(Math.random() * 1000);
}

async function checkPreviewHealthy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http');
    const url = `http://localhost:${port}`;
    const req = http.get(url, (res: any) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const totalStart = Date.now();

  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json(
      { ok: false, error: 'Project not found or you do not have access.' },
      { status: 404 }
    );
  }

  const projectId = project._id;
  const workspacePath = workspacePathForProject(params.projectId);

  // Reuse existing preview server if healthy
  if (project.preview?.status === 'ready' && project.preview?.port) {
    const { port } = project.preview;
    const isHealthy = await checkPreviewHealthy(port);
    if (isHealthy) {
      const totalMs = Date.now() - totalStart;
      console.log(`[preview-start] reuse existing server on port ${port}, total took ${totalMs}ms`);
      return NextResponse.json({
        ok: true,
        preview: { status: 'ready', url: `http://localhost:${port}`, port },
        reused: true,
      });
    }
  }

  // Stop any stale preview server (regardless of status - may be orphaned)
  if (project.preview?.port) {
    await stopPreviewServerByPort(project.preview.port);
  }

  // Use draftSiteSpec if available, otherwise fall back to siteSpec
  const spec = project.draftSiteSpec || project.siteSpec;

  // Initialize preview status
  await WebsiteProject.updateOne({ _id: projectId }, {
    $set: {
      'preview.status': 'building',
      'preview.startedAt': new Date(),
    },
  });

  try {
    // Ensure cached preview runtime exists (skips npm install if already cached)
    const ensureStart = Date.now();
    await ensurePreviewRuntime();
    console.log(`[preview/start] ensurePreviewRuntime took ${Date.now() - ensureStart}ms`);

    // Generate project files
    const genStart = Date.now();
    const generated = generateWebsiteFiles(
      spec as unknown as import('@/lib/agent/schemas').SiteSpec,
      project.name || 'project-preview',
      undefined
    );
    console.log(`[preview/start] generateFiles took ${Date.now() - genStart}ms`);

    // Validate files
    const valStart = Date.now();
    const validationErrors = validateGeneratedFiles(spec as unknown as import('@/lib/agent/schemas').SiteSpec, project.name || 'project-preview');
    if (validationErrors.length > 0) {
      const errMsg = 'Validation failed: ' + validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
      await WebsiteProject.updateOne({ _id: projectId }, {
        $set: {
          'preview.status': 'failed',
          'preview.error': errMsg,
        },
      });
      throw new Error(errMsg);
    }
    console.log(`[preview/start] validateFiles took ${Date.now() - valStart}ms`);

    // Clean workspace and copy base runtime (without node_modules)
    const copyStart = Date.now();
    if (existsSync(workspacePath)) {
      rmSync(workspacePath, { recursive: true, force: true });
    }
    mkdirSync(workspacePath, { recursive: true });

    const runtimePath = scratchPath('preview-runtime');
    cpSync(runtimePath, workspacePath, { recursive: true, filter: (_src, dest) => {
      return !dest.includes('node_modules');
    }});

    // Write project-specific generated files
    writeFilesToDisk(generated.files, workspacePath);
    console.log(`[preview/start] copyWorkspace took ${Date.now() - copyStart}ms`);

    // Start preview server using the runtime's next binary directly
    const port = allocatePort();
    const runtimeNextBin = join(runtimePath, 'node_modules', '.bin', 'next');
    const { spawn } = await import('child_process');
    const nodeBin = process.execPath;
    const devProcess = spawn(nodeBin, [runtimeNextBin, 'dev', '-H', '0.0.0.0', '-p', String(port)], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: false,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        NODE_PATH: join(runtimePath, 'node_modules'),
      },
    });

    // Capture stdout/stderr while server runs
    let stdoutData = '';
    let stderrData = '';
    if (devProcess.stdout) {
      devProcess.stdout.on('data', (chunk: Buffer) => { stdoutData += chunk.toString(); });
    }
    if (devProcess.stderr) {
      devProcess.stderr.on('data', (chunk: Buffer) => { stderrData += chunk.toString(); });
    }

    // Wait for server to start
    await new Promise(r => setTimeout(r, 5000));

    // Check if process exited early
    if (devProcess.exitCode !== null) {
      const errMsg = `Preview server exited early with code ${devProcess.exitCode}.\nstdout: ${stdoutData}\nstderr: ${stderrData}`;
      console.log(`[preview/start] startServer FAILED: ${errMsg}`);
      await WebsiteProject.updateOne({ _id: projectId }, {
        $set: {
          'preview.status': 'failed',
          'preview.error': errMsg,
        },
      });
      throw new Error(errMsg);
    }

    // Detach streams so process keeps running
    devProcess.stdout?.removeAllListeners();
    devProcess.stderr?.removeAllListeners();
    devProcess.unref();

    const previewUrl = `http://localhost:${port}`;
    console.log(`[preview/start] startServer took ${Date.now() - copyStart}ms`);

    // Wait for server to be healthy
    const healthStart = Date.now();
    try {
      await waitForPreviewReady(previewUrl, { timeoutMs: 60000, intervalMs: 1000 });
    } catch (healthError) {
      const errMsg = healthError instanceof Error ? healthError.message : 'Preview server failed to start';
      await WebsiteProject.updateOne({ _id: projectId }, {
        $set: {
          'preview.status': 'failed',
          'preview.error': errMsg,
        },
      });
      throw new Error(errMsg);
    }
    console.log(`[preview/start] healthCheck took ${Date.now() - healthStart}ms`);

    // Mark ready
    await WebsiteProject.updateOne({ _id: projectId }, {
      $set: {
        'preview.status': 'ready',
        'preview.url': previewUrl,
        'preview.port': port,
        'preview.workspacePath': workspacePath,
        'preview.startedAt': new Date(),
      },
    });

    const totalMs = Date.now() - totalStart;
    console.log(`[preview/start] total took ${totalMs}ms`);

    return NextResponse.json({
      ok: true,
      preview: { status: 'ready', url: previewUrl, port },
      reused: false,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await WebsiteProject.updateOne({ _id: projectId }, {
      $set: {
        'preview.status': 'failed',
        'preview.error': errMsg,
      },
    });
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';
import { startWorkspaceDevServer } from '@/lib/preview/startWorkspaceDevServer';
import { waitForPreviewReady } from '@/lib/preview/waitForPreviewReady';

const runBuildGate = process.env.RUN_BUILD_GATE === '1';

const cloneLikeSpec: SiteSpec = {
  siteTitle: 'tests.com HVAC Prep',
  tagline: 'Practice exams and certification prep',
  primaryCTA: 'Start practice',
  secondaryCTA: 'Contact us',
  sections: [
    { type: 'hero', title: 'HVAC Practice Tests', body: 'Prepare for certification success', items: [] },
    { type: 'services', title: 'Our Products', body: 'Exam resources', items: ['HVAC Practice Exam', 'EPA 608 Prep'] },
    { type: 'about', title: 'About tests.com', body: 'Trusted prep provider', items: [] },
    {
      type: 'testimonials',
      title: 'What students say',
      body: 'Real results',
      items: ['Passed on the first try'],
    },
    { type: 'contact', title: 'Contact', body: 'Get in touch', items: ['Phone: (800) 394-5268'] },
  ],
  designDirection: { tone: 'warm', layout: 'modern', colors: ['#1E3A5F', '#2D8A4E'] },
};

function allocatePort(): number {
  return 3001 + Math.floor(Math.random() * 1000);
}

function writeFilesToDisk(
  files: Array<{ filePath: string; content: string }>,
  workspacePath: string
): void {
  for (const file of files) {
    const filePath = join(workspacePath, file.filePath);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, file.content, 'utf-8');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopDevServer(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null) return;
  try {
    process.kill('SIGTERM');
  } catch {
    return;
  }
  await Promise.race([
    new Promise<void>((resolve) => process.once('exit', () => resolve())),
    sleep(3000),
  ]);
  if (process.exitCode === null) {
    try {
      process.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

async function npmInstall(workspacePath: string): Promise<void> {
  const npmPath = getNpmPath();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(npmPath, ['install', '--legacy-peer-deps'], {
      cwd: workspacePath,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm install failed with code ${code}\n${stderr.slice(-800)}`))
    );
    child.on('error', reject);
  });
}

describe.runIf(runBuildGate)('clone preview throughout integration', () => {
  let workspacePath = '';
  let devProcess: ChildProcess | null = null;

  afterEach(async () => {
    if (devProcess) {
      await stopDevServer(devProcess);
      devProcess = null;
    }

    if (workspacePath && existsSync(workspacePath)) {
      await fs.rm(workspacePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      workspacePath = '';
    }
  });

  it('generateWebsiteFiles → validate → dev server → HTTP health check', async () => {
    const projectName = 'clone-preview-throughout-integration';
    const generated = generateWebsiteFiles(
      cloneLikeSpec,
      projectName,
      getDefaultDesignBrief('restaurant'),
      { category: 'restaurant', variant: 'restaurant-warm', reason: 'integration test' }
    );

    const validation = await validateGeneratedSite({
      files: generated.files,
      projectName,
    });
    expect(validation.ok, validation.errors.join('; ') || validation.logs).toBe(true);
    expect(validation.files?.length).toBeGreaterThan(0);

    const workspaceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    workspacePath = scratchPath(`clone-preview-throughout-${workspaceId}`);
    mkdirSync(workspacePath, { recursive: true });
    writeFilesToDisk(validation.files ?? generated.files, workspacePath);

    await npmInstall(workspacePath);

    const port = allocatePort();
    const previewUrl = `http://127.0.0.1:${port}`;

    devProcess = await startWorkspaceDevServer(workspacePath, port, { timeoutMs: 180_000 });

    await waitForPreviewReady(previewUrl, { timeoutMs: 120_000, intervalMs: 2000 });

    const res = await fetch(previewUrl);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);

    const html = await res.text();
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/<html/i);
  }, 360_000);
});

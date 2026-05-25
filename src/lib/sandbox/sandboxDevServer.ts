import type { Sandbox } from '@vercel/sandbox';
import {
  checkPreviewUrlHealthy,
  waitForPreviewReady,
} from '@/lib/preview/waitForPreviewReady';
import { getProjectSandbox } from './sandboxClient';
import { SANDBOX_WORKDIR } from './types';

/** Stop dev server and remove stale Next/webpack output (fixes missing chunk e.g. ./819.js). */
export async function clearSandboxDevArtifacts(sandbox: Sandbox): Promise<void> {
  await sandbox.runCommand({
    cmd: 'sh',
    args: [
      '-c',
      'fuser -k 3000/tcp 2>/dev/null || true; pkill -f "next dev" 2>/dev/null || true; rm -rf .next',
    ],
    cwd: SANDBOX_WORKDIR,
  });
}

export async function startSandboxDevServerDetached(sandbox: Sandbox): Promise<void> {
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

/**
 * Fresh `next dev` after edits — production build artifacts in .next break the dev bundler.
 */
export async function restartSandboxDevServer(projectId: string): Promise<string> {
  const sandbox = await getProjectSandbox(projectId);
  await clearSandboxDevArtifacts(sandbox);
  await startSandboxDevServerDetached(sandbox);
  const previewUrl = sandbox.domain(3000);
  await waitForSandboxPreview(previewUrl);
  return previewUrl;
}

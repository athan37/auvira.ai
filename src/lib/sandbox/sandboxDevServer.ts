import type { Sandbox } from '@vercel/sandbox';
import { getProjectSandbox } from './sandboxClient';
import { waitForSandboxPreview } from './sandboxPreviewHealth';
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

/**
 * Fresh `next dev` after edits — production build artifacts in .next break the dev bundler.
 */
export async function restartSandboxDevServer(projectId: string): Promise<string> {
  const sandbox = await getProjectSandbox(projectId);
  const { repairPreviewSandbox } = await import('./repairPreviewSandbox');
  await repairPreviewSandbox(projectId).catch(() => {});
  await clearSandboxDevArtifacts(sandbox);
  await startSandboxDevServerDetached(sandbox);
  const previewUrl = sandbox.domain(3000);
  await waitForSandboxPreview(previewUrl);
  return previewUrl;
}

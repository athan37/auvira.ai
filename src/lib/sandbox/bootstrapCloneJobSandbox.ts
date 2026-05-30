import { Sandbox } from '@vercel/sandbox';
import { cacheSandbox, defaultSandboxTimeoutMs } from './sandboxClient';
import { writeSandboxFile } from './sandboxFsWrite';
import { sandboxNameForCloneJob } from './sandboxNames';
import { clearSandboxDevArtifacts, startSandboxDevServerDetached } from './sandboxDevServer';
import { waitForSandboxPreview } from './sandboxPreviewHealth';
import { SANDBOX_WORKDIR } from './types';

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

/**
 * Bootstrap an ephemeral sandbox preview for a clone job (generated files, no GitLab).
 */
export async function bootstrapCloneJobSandbox(
  jobId: string,
  files: Array<{ filePath: string; content: string }>
): Promise<{ previewUrl: string; sandboxName: string }> {
  const sandboxName = sandboxNameForCloneJob(jobId);
  const timeoutMs = defaultSandboxTimeoutMs();

  const sandbox = await Sandbox.getOrCreate({
    name: sandboxName,
    timeout: timeoutMs,
    runtime: 'node24',
    ports: [3000],
    persistent: false,
  });

  cacheSandbox(`clone-${jobId}`, sandbox);

  await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', 'find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +'],
    cwd: SANDBOX_WORKDIR,
  }).catch(() => {});

  for (const file of files) {
    const absPath = `${SANDBOX_WORKDIR}/${file.filePath}`;
    await writeSandboxFile(sandbox, absPath, file.content);
  }

  if (!(await nodeModulesPresent(sandbox))) {
    await runNpmInstall(sandbox);
  }

  await clearSandboxDevArtifacts(sandbox);
  await startSandboxDevServerDetached(sandbox);
  const previewUrl = sandbox.domain(3000);
  await waitForSandboxPreview(previewUrl);

  return { previewUrl, sandboxName };
}

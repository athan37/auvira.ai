import { existsSync } from 'fs';
import { join } from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { getNpmPath } from '@/lib/runtime/nodeRuntime';
import { waitForPreviewReady } from '@/lib/preview/waitForPreviewReady';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveNextDevCommand(workspacePath: string, port: number): {
  command: string;
  args: string[];
  cwd: string;
} {
  const localNext = join(workspacePath, 'node_modules', '.bin', 'next');
  if (existsSync(localNext)) {
    return {
      command: localNext,
      args: ['dev', '-H', '127.0.0.1', '-p', String(port)],
      cwd: workspacePath,
    };
  }
  return {
    command: getNpmPath(),
    args: ['exec', '--', 'next', 'dev', '-H', '127.0.0.1', '-p', String(port)],
    cwd: workspacePath,
  };
}

/**
 * Start Next.js dev server for a cloned workspace and wait until HTTP responds.
 */
export async function startWorkspaceDevServer(
  workspacePath: string,
  port: number,
  options: { timeoutMs?: number } = {}
): Promise<ChildProcess> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pkgPath = join(workspacePath, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json in workspace: ${workspacePath}`);
  }

  const { command, args, cwd } = resolveNextDevCommand(workspacePath, port);
  let stderr = '';
  let stdout = '';

  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
    },
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitEarly = new Promise<never>((_, reject) => {
    child.on('error', (err) => {
      reject(new Error(`Failed to spawn preview dev server: ${err.message}`));
    });
    child.on('exit', (code, signal) => {
      const tail = (stderr || stdout).slice(-1200);
      reject(
        new Error(
          `Preview dev server exited before ready (code=${code ?? 'null'}, signal=${signal ?? 'null'}). ${tail}`
        )
      );
    });
  });

  // Allow Next a moment to bind the port before polling.
  await sleep(4000);

  if (child.exitCode !== null) {
    const tail = (stderr || stdout).slice(-1200);
    throw new Error(`Preview dev server exited during startup. ${tail}`);
  }

  const ready = waitForPreviewReady(`http://127.0.0.1:${port}`, {
    timeoutMs,
    intervalMs: 2000,
    acceptAnyHttpStatus: true,
  });

  try {
    await Promise.race([ready, exitEarly]);
  } catch (err) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err);
    const tail = (stderr || stdout).slice(-1200);
    throw new Error(
      tail && !msg.includes(tail) ? `${msg}\n\nDev server output:\n${tail}` : msg
    );
  }

  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.unref();

  return child;
}

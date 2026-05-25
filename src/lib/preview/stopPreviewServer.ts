import { execSync } from 'child_process';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stops process(es) listening on the given TCP port.
 * Only targets PIDs bound to that port — never kills unrelated node processes.
 */
export async function stopPreviewServerByPort(port: number): Promise<void> {
  let pids: string[] = [];
  try {
    const out = execSync(`lsof -ti tcp:${port}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (out) {
      pids = out.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    return;
  }

  for (const pidStr of pids) {
    const pid = Number(pidStr);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already exited
      }
    }
  }

  for (let i = 0; i < 15; i++) {
    await sleep(200);
    try {
      execSync(`lsof -ti tcp:${port}`, { stdio: 'ignore' });
    } catch {
      return;
    }
  }
}

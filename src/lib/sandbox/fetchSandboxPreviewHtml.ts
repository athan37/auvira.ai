import { getProjectSandbox } from './sandboxClient';
import { SANDBOX_WORKDIR } from './types';

/**
 * Fetch homepage HTML from inside the sandbox VM (loopback dev server).
 * More reliable than the public sandbox URL right after `next dev` restart.
 */
export async function fetchHtmlFromSandboxLoopback(projectId: string): Promise<string | null> {
  try {
    const sandbox = await getProjectSandbox(projectId);
    const result = await sandbox.runCommand({
      cmd: 'curl',
      args: [
        '-s',
        '-L',
        '--max-time',
        '30',
        `http://127.0.0.1:3000/?_sa_verify=${Date.now()}`,
      ],
      cwd: SANDBOX_WORKDIR,
    });
    if (result.exitCode !== 0 && result.exitCode !== null) {
      return null;
    }
    const stdout = await result.stdout();
    return stdout.length > 500 ? stdout : null;
  } catch {
    return null;
  }
}

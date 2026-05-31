import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Quick production build smoke after analytics instrumentation (best-effort).
 * Throws when build fails so callers can log or block publish.
 */
export async function runPublishBuildSmoke(workspacePath: string): Promise<void> {
  const resolved = path.resolve(workspacePath);
  const packageJsonPath = path.join(resolved, 'package.json');
  try {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    if (!pkg.scripts?.build) return;

    await execFileAsync('npm', ['run', 'build'], {
      cwd: resolved,
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, CI: 'true' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Publish build smoke failed: ${msg}`);
  }
}

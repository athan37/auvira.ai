import type { ValidateWorkspaceResult } from '@/lib/project-workspace/validateWorkspace';
import { getProjectSandbox } from './sandboxClient';
import { SANDBOX_WORKDIR } from './types';

/**
 * Run `npm run build` inside the sandbox VM after an edit.
 */
export async function validateSandboxWorkspace(
  projectId: string,
  changedFiles?: string[]
): Promise<ValidateWorkspaceResult> {
  const sandbox = await getProjectSandbox(projectId);
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const pkgCheck = await sandbox.runCommand({
    cmd: 'test',
    args: ['-f', 'package.json'],
    cwd: SANDBOX_WORKDIR,
  });
  if (pkgCheck.exitCode !== 0) {
    return { ok: true, buildLog: 'No package.json — skipped build', errors, warnings };
  }

  const build = await sandbox.runCommand({
    cmd: 'npm',
    args: ['run', 'build'],
    cwd: SANDBOX_WORKDIR,
  });
  const stdout = await build.stdout();
  const stderr = await build.stderr();
  logs.push(stdout, stderr);

  if (build.exitCode !== 0) {
    errors.push('Build failed in sandbox preview');
    if (changedFiles?.length) {
      warnings.push(`Changed files: ${changedFiles.slice(0, 10).join(', ')}`);
    }
    return {
      ok: false,
      buildLog: logs.join('\n').slice(-8000),
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    buildLog: logs.join('\n').slice(-4000),
    errors,
    warnings,
  };
}

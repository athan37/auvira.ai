import type { ValidateWorkspaceResult } from '@/lib/project-workspace/validateWorkspace';
import { repairSiteConfigTypesViaGateway } from '@/lib/preview/repairSiteConfigTypes';
import { validateChangedSourceSyntax } from '@/lib/project-workspace/validateTsxSyntax';
import { getProjectSandbox } from './sandboxClient';
import { getSandboxGateway } from './sandboxWorkspaceGateway';
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

  try {
    const gateway = await getSandboxGateway(projectId);
    if (await repairSiteConfigTypesViaGateway(gateway)) {
      logs.push('Repaired siteConfig.ts types to include gallery/documentation sections');
    }
  } catch (e) {
    warnings.push(
      `siteConfig type repair skipped: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const changed = new Set(changedFiles || []);
  const lockChanged =
    changed.has('package.json') ||
    changed.has('package-lock.json') ||
    changed.has('yarn.lock') ||
    changed.has('pnpm-lock.yaml');
  const previewSafeEdit =
    changed.size > 0 &&
    !lockChanged &&
    [...changed].every(
      (f) =>
        f.startsWith('src/') &&
        /\.(css|scss|sass|less|tsx|jsx|ts|js|json)$/i.test(f)
    );

  if (previewSafeEdit) {
    logs.push(
      'Source-only edit: skipping npm run build (sandbox preview uses next dev; production .next breaks dev chunks)'
    );
    try {
      const gateway = await getSandboxGateway(projectId);
      const syntax = await validateChangedSourceSyntax(
        async (rel) => {
          try {
            return await gateway.readFile(rel);
          } catch {
            return null;
          }
        },
        [...changed]
      );
      if (!syntax.ok) {
        errors.push(...syntax.errors.slice(0, 5));
        if (syntax.errors.length > 5) {
          errors.push(`…and ${syntax.errors.length - 5} more syntax error(s)`);
        }
        return { ok: false, buildLog: logs.join('\n'), errors, warnings };
      }
      logs.push('TS/TSX syntax check passed for changed files');
    } catch (e) {
      warnings.push(
        `Syntax check skipped: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    return { ok: true, buildLog: logs.join('\n'), errors, warnings };
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

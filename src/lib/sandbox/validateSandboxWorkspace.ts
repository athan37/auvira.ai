import type { Sandbox } from '@vercel/sandbox';
import type { ValidateWorkspaceResult } from '@/lib/project-workspace/validateWorkspace';
import { customerSiteProductionBuildEnv } from '@/lib/builder/prepareGeneratedWorkspaceForBuild';
import { isPreviewSafeEdit } from '@/lib/project-workspace/previewSafeValidation';
import { repairSiteConfigTypesViaGateway } from '@/lib/preview/repairSiteConfigTypes';
import { repairPreviewSandbox } from '@/lib/sandbox/repairPreviewSandbox';
import { validateChangedSourceSyntax } from '@/lib/project-workspace/validateTsxSyntax';
import { sanitizeAgentMarkerFilesInWorkspace } from '@/lib/site-manager/siteConfigAgentMarkers';
import { clearSandboxDevArtifacts, restartSandboxDevServer } from './sandboxDevServer';
import { getProjectSandbox } from './sandboxClient';
import { getSandboxGateway } from './sandboxWorkspaceGateway';
import { SANDBOX_WORKDIR } from './types';

function sandboxProductionBuildEnv(): Record<string, string> {
  const env = customerSiteProductionBuildEnv();
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      out[key] = String(value);
    }
  }
  return out;
}

function summarizeSandboxBuildFailure(stdout: string, stderr: string): string {
  const combined = `${stderr}\n${stdout}`.trim();
  if (!combined) {
    return 'Build failed in sandbox preview';
  }
  const lines = combined.split('\n').map((line) => line.trim()).filter(Boolean);
  const tail = lines.slice(-8).join(' | ');
  return tail.length > 400 ? `Build failed in sandbox preview: …${tail.slice(-400)}` : `Build failed in sandbox preview: ${tail}`;
}

/** Ensure deps exist before a production build in the sandbox VM. */
async function ensureSandboxNodeModules(
  sandbox: Sandbox,
  logs: string[]
): Promise<void> {
  const check = await sandbox.runCommand({
    cmd: 'test',
    args: ['-d', 'node_modules'],
    cwd: SANDBOX_WORKDIR,
  });
  if (check.exitCode === 0) {
    return;
  }

  logs.push('> npm install --legacy-peer-deps (node_modules missing before production build)');
  const install = await sandbox.runCommand({
    cmd: 'npm',
    args: ['install', '--legacy-peer-deps'],
    cwd: SANDBOX_WORKDIR,
    env: { CI: 'true', NODE_ENV: 'development' },
  });
  const installOut = await install.stdout();
  const installErr = await install.stderr();
  if (installOut) {
    logs.push(installOut);
  }
  if (installErr) {
    logs.push(installErr);
  }
  if (install.exitCode !== 0) {
    throw new Error(installErr.slice(-500) || 'npm install failed in sandbox before production build');
  }
}

/**
 * Run `npm run build` inside the sandbox VM (post-edit or pre-deploy gate).
 * Stops `next dev` and clears `.next` before production build — same as local validateWorkspace.
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

  let gateway: Awaited<ReturnType<typeof getSandboxGateway>> | null = null;
  try {
    gateway = await getSandboxGateway(projectId);
    if (await repairSiteConfigTypesViaGateway(gateway)) {
      logs.push('Repaired siteConfig.ts types to include gallery/documentation sections');
    }

    const sanitizedMarkers = await sanitizeAgentMarkerFilesInWorkspace('', {
      read: async (rel) => {
        try {
          return await gateway!.readFile(rel);
        } catch {
          return null;
        }
      },
      write: async (rel, content) => {
        await gateway!.writeFile(rel, content);
      },
    });
    if (sanitizedMarkers.length > 0) {
      logs.push(`Removed dev-only agent sync markers from: ${sanitizedMarkers.join(', ')}`);
    }

    await repairPreviewSandbox(projectId);
    logs.push('Applied preview-safe workspace repairs (page/siteConfig parity)');
  } catch (e) {
    warnings.push(
      `siteConfig type repair skipped: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const changedList = [...(changedFiles || [])];
  const previewSafeEdit = isPreviewSafeEdit(changedList);

  if (previewSafeEdit) {
    logs.push(
      'Source-only edit: skipping npm run build (sandbox preview uses next dev; production .next breaks dev chunks)'
    );
    try {
      const gw = gateway ?? (await getSandboxGateway(projectId));
      const syntax = await validateChangedSourceSyntax(
        async (rel) => {
          try {
            return await gw.readFile(rel);
          } catch {
            return null;
          }
        },
        changedList
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

  const isDeployBuildGate = changedFiles === undefined;

  try {
    await clearSandboxDevArtifacts(sandbox);
    logs.push('Stopped sandbox next dev and cleared .next before production build');
  } catch (e) {
    warnings.push(
      `Could not clear sandbox dev artifacts before build: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }

  try {
    await ensureSandboxNodeModules(sandbox, logs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return { ok: false, buildLog: logs.join('\n').slice(-8000), errors, warnings };
  }

  const build = await sandbox.runCommand({
    cmd: 'npm',
    args: ['run', 'build'],
    cwd: SANDBOX_WORKDIR,
    env: sandboxProductionBuildEnv(),
  });
  const stdout = await build.stdout();
  const stderr = await build.stderr();
  logs.push(stdout, stderr);

  const buildOk = build.exitCode === 0;

  if (isDeployBuildGate) {
    void restartSandboxDevServer(projectId)
      .then(() => {
        logs.push('Restarted sandbox next dev after production build check');
      })
      .catch((e) => {
        warnings.push(
          `Preview restart after build check failed: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      });
  }

  if (!buildOk) {
    errors.push(summarizeSandboxBuildFailure(stdout, stderr));
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

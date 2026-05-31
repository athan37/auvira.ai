import type { ValidateWorkspaceResult } from '@/lib/project-workspace/validateWorkspace';
import { isPreviewSafeEdit } from '@/lib/project-workspace/previewSafeValidation';
import { repairSiteConfigTypesViaGateway } from '@/lib/preview/repairSiteConfigTypes';
import { repairPreviewSandbox } from '@/lib/sandbox/repairPreviewSandbox';
import { validateChangedSourceSyntax } from '@/lib/project-workspace/validateTsxSyntax';
import { sanitizeAgentMarkerFilesInWorkspace } from '@/lib/site-manager/siteConfigAgentMarkers';
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

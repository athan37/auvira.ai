import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { repairSiteConfigTypesInWorkspace } from '@/lib/preview/repairSiteConfigTypes';
import { validateChangedSourceSyntax } from './validateTsxSyntax';

const execFileAsync = promisify(execFile);

export interface ValidateWorkspaceResult {
  ok: boolean;
  buildLog: string;
  errors: string[];
  warnings: string[];
}

export interface ValidateWorkspaceOptions {
  changedFiles?: string[];
}

/**
 * Validate a code workspace after an agent edit.
 * Runs npm build when package.json exists; otherwise checks static HTML.
 */
export async function validateWorkspace(
  workspacePath: string,
  options: ValidateWorkspaceOptions = {}
): Promise<ValidateWorkspaceResult> {
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const resolved = path.resolve(workspacePath);

  const siteConfigRepaired = await repairSiteConfigTypesInWorkspace(resolved);
  if (siteConfigRepaired) {
    logs.push('Repaired siteConfig.ts types to include gallery/documentation sections');
  }

  let packageJsonPath: string;
  try {
    packageJsonPath = path.join(resolved, 'package.json');
    await fs.access(packageJsonPath);
  } catch {
    return validateStaticWorkspace(resolved, logs, errors, warnings);
  }

  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  } catch (e) {
    errors.push('Invalid package.json');
    return { ok: false, buildLog: logs.join('\n'), errors, warnings };
  }

  const scripts = pkg.scripts || {};
  const changed = new Set(options.changedFiles || []);
  const changedList = [...changed];

  const lockChanged =
    changed.has('package.json') ||
    changed.has('package-lock.json') ||
    changed.has('yarn.lock') ||
    changed.has('pnpm-lock.yaml');

  /** Preview uses `next dev` — skip slow/flaky production build for src-only edits. */
  const previewSafeEdit =
    changedList.length > 0 &&
    !lockChanged &&
    changedList.every(
      (f) =>
        f.startsWith('src/') &&
        /\.(css|scss|sass|less|tsx|jsx|ts|js|json)$/i.test(f)
    );

  if (previewSafeEdit) {
    logs.push(
      'Source-only edit: skipping npm run build (editable preview uses the dev server, not static export)'
    );
    const syntax = await validateChangedSourceSyntax(
      async (rel) => {
        try {
          return await fs.readFile(path.join(resolved, rel), 'utf-8');
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
    return { ok: true, buildLog: logs.join('\n'), errors, warnings };
  }

  const nodeModulesPath = path.join(resolved, 'node_modules');
  let needsInstall = lockChanged;
  if (!needsInstall) {
    try {
      await fs.access(nodeModulesPath);
    } catch {
      needsInstall = true;
    }
  }

  if (needsInstall) {
    try {
      const lockPath = path.join(resolved, 'package-lock.json');
      let useCi = false;
      try {
        await fs.access(lockPath);
        useCi = true;
      } catch {
        useCi = false;
      }

      const installCmd = useCi ? 'ci' : 'install';
      logs.push(`> npm ${installCmd}`);
      const { stdout, stderr } = await execFileAsync('npm', [installCmd], {
        cwd: resolved,
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, CI: 'true' },
      });
      if (stdout) logs.push(stdout);
      if (stderr) logs.push(stderr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stderr = (e as { stderr?: string })?.stderr || '';
      logs.push(stderr);
      errors.push(`npm install failed: ${msg}`);
      return { ok: false, buildLog: logs.join('\n'), errors, warnings };
    }
  }

  if (scripts.build) {
    try {
      logs.push('> npm run build');
      const { stdout, stderr } = await execFileAsync('npm', ['run', 'build'], {
        cwd: resolved,
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, CI: 'true' },
      });
      if (stdout) logs.push(stdout);
      if (stderr) logs.push(stderr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stderr = (e as { stderr?: string })?.stderr || '';
      logs.push(stderr);
      errors.push(`Build failed: ${msg}`);
      return { ok: false, buildLog: logs.join('\n'), errors, warnings };
    }
  } else {
    warnings.push('No build script in package.json — skipped npm run build');
  }

  if (scripts.lint) {
    try {
      logs.push('> npm run lint');
      const { stdout, stderr } = await execFileAsync('npm', ['run', 'lint'], {
        cwd: resolved,
        timeout: 120000,
        maxBuffer: 5 * 1024 * 1024,
      });
      if (stdout) logs.push(stdout);
      if (stderr) warnings.push(stderr);
    } catch (e) {
      const stderr = (e as { stderr?: string })?.stderr || '';
      warnings.push(`Lint reported issues (non-fatal): ${stderr || String(e)}`);
    }
  }

  return { ok: true, buildLog: logs.join('\n'), errors, warnings };
}

async function validateStaticWorkspace(
  workspacePath: string,
  logs: string[],
  errors: string[],
  warnings: string[]
): Promise<ValidateWorkspaceResult> {
  logs.push('Static workspace validation');

  const indexPath = path.join(workspacePath, 'index.html');
  try {
    const html = await fs.readFile(indexPath, 'utf-8');
    if (!html.trim()) {
      errors.push('index.html is empty');
      return { ok: false, buildLog: logs.join('\n'), errors, warnings };
    }
  } catch {
    errors.push('index.html is missing');
    return { ok: false, buildLog: logs.join('\n'), errors, warnings };
  }

  const cssPath = path.join(workspacePath, 'styles.css');
  try {
    await fs.access(cssPath);
  } catch {
    warnings.push('styles.css not found (optional)');
  }

  logs.push('Static workspace OK');
  return { ok: true, buildLog: logs.join('\n'), errors, warnings };
}

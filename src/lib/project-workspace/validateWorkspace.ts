import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { repairTailwindConfigInWorkspace } from '@/lib/builder/tailwindPresentationSupport';
import { repairSiteConfigTypesInWorkspace } from '@/lib/preview/repairSiteConfigTypes';
import { sanitizeSourceForPublish } from '@/lib/site-manager/siteConfigAgentMarkers';
import { validateChangedSourceSyntax } from './validateTsxSyntax';
import { repairPageTsxStructure } from './repairPageTsxStructure';

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

const MARKER_SANITIZE_PATHS = ['src/app/page.tsx', 'src/lib/siteConfig.ts'] as const;

/** Auto-fix known ESLint/structure issues in page.tsx before build. */
async function repairPageTsxInWorkspace(workspacePath: string): Promise<string[]> {
  const rel = 'src/app/page.tsx';
  const abs = path.join(workspacePath, rel);
  let before: string;
  try {
    before = await fs.readFile(abs, 'utf-8');
  } catch {
    return [];
  }
  const { content, repaired } = repairPageTsxStructure(before);
  if (!repaired || content === before) {
    return [];
  }
  await fs.writeFile(abs, content, 'utf-8');
  return [rel];
}

async function sanitizeMarkerFilesInWorkspace(workspacePath: string): Promise<string[]> {
  const sanitized: string[] = [];
  for (const rel of MARKER_SANITIZE_PATHS) {
    const abs = path.join(workspacePath, rel);
    let before: string;
    try {
      before = await fs.readFile(abs, 'utf-8');
    } catch {
      continue;
    }
    const after = sanitizeSourceForPublish(rel, before);
    if (after !== before) {
      await fs.writeFile(abs, after, 'utf-8');
      sanitized.push(rel);
    }
  }
  return sanitized;
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

  const tailwindRepaired = await repairTailwindConfigInWorkspace(resolved);
  if (tailwindRepaired) {
    logs.push(
      'Repaired tailwind.config.js: full src/** content scan + safelist for section presentation classes'
    );
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
  const sanitizedMarkers = await sanitizeMarkerFilesInWorkspace(resolved);
  if (sanitizedMarkers.length > 0) {
    logs.push(`Removed dev-only agent sync markers from: ${sanitizedMarkers.join(', ')}`);
  }

  const repairedPage = await repairPageTsxInWorkspace(resolved);
  if (repairedPage.length > 0) {
    logs.push(`Repaired page.tsx structure/ESLint issues before validation`);
  }

  const lockChanged =
    changed.has('package.json') ||
    changed.has('package-lock.json') ||
    changed.has('yarn.lock') ||
    changed.has('pnpm-lock.yaml');

  /** Preview uses `next dev` — skip slow/flaky production build for presentation/style edits. */
  const isPreviewSafePath = (f: string): boolean => {
    if (f === 'tailwind.config.js' || f === 'tailwind.config.ts') return true;
    return (
      f.startsWith('src/') && /\.(css|scss|sass|less|tsx|jsx|ts|js|json)$/i.test(f)
    );
  };
  const previewSafeEdit =
    changedList.length > 0 &&
    !lockChanged &&
    changedList.every(isPreviewSafePath);

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

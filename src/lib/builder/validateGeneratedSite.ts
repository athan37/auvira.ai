import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

import { getNodeBinDir } from '@/lib/runtime/nodeRuntime';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { prepareGeneratedWorkspaceForBuild } from '@/lib/builder/prepareGeneratedWorkspaceForBuild';
import { validateGeneratedFiles, templateDistinctivenessCheck } from '@/lib/builder/validateGeneratedFiles';

const execFileAsync = promisify(execFile);

export interface GeneratedFile {
  filePath: string;
  content: string;
}

export interface ValidateGeneratedSiteInput {
  files: GeneratedFile[];
  projectName: string;
}

export interface ValidateGeneratedSiteResult {
  ok: boolean;
  tempDir: string;
  logs: string;
  errors: string[];
  durationMs: number;
  /** Repaired file set that passed the gate (synced from temp workspace). */
  files?: GeneratedFile[];
  /** True when npm install/build was skipped (e.g. Vercel serverless). */
  buildGateSkipped?: boolean;
}

/** npm install + next build need disk/time; unreliable on Vercel serverless. */
export function shouldRunLocalNpmBuildGate(): boolean {
  if (process.env.SITE_AGENT_RUN_BUILD_GATE === '1') return true;
  if (process.env.SITE_AGENT_SKIP_BUILD_GATE === '1') return false;
  return !isVercelServerless();
}

const REQUIRED_FILES = [
  'package.json',
  'next.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/globals.css',
  'src/lib/siteConfig.ts',
  'src/lib/analyticsConfig.ts',
  'src/lib/analyticsAttrs.ts',
  'src/components/analytics/WebsiteAnalytics.tsx',
  'README.md',
];

const PAGE_TSX_RUNTIME_BAD_PATTERNS = [
  '__siteAgentPageGallerySync',
  'export const __site',
  'Cannot find name',
  "from '../agent",
  "from '../../agent",
  '@/lib/agent',
  'process.env',
  'require(',
  'import.meta',
  "{'{'}",
  "{'}",
  "{'{'}$",
];

function sanitizeProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function checkStringPatterns(content: string, patterns: string[], fileName: string): string[] {
  const errors: string[] = [];
  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      errors.push(`${fileName}: contains unsafe pattern "${pattern}"`);
    }
  }
  return errors;
}

async function syncWorkspaceFilesFromDisk(tempDir: string, files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const abs = path.join(tempDir, file.filePath);
    try {
      file.content = await fs.promises.readFile(abs, 'utf-8');
    } catch {
      // keep in-memory content when file missing on disk
    }
  }
}

function detectIndustryFromContent(pageContent: string): string | null {
  const legalScore = (pageContent.match(/practice areas?|attorney|lawyer|free consultation/i) || []).length;
  const homeServicesScore = (pageContent.match(/service area|24\/7|emergency|licensed|insured|contractor|hvac|plumb/i) || []).length;
  const restaurantScore = (pageContent.match(/menu|hours|reserve|restaurant|cafe|dining/i) || []).length;
  const healthcareScore = (pageContent.match(/appointment|doctor|physician|insurance|medical|clinic/i) || []).length;

  const maxScore = Math.max(legalScore, homeServicesScore, restaurantScore, healthcareScore);
  if (maxScore < 2) return null;

  if (legalScore === maxScore) return 'legal';
  if (homeServicesScore === maxScore) return 'home-services';
  if (restaurantScore === maxScore) return 'restaurant';
  if (healthcareScore === maxScore) return 'healthcare';
  return null;
}

export async function validateGeneratedSite(
  input: ValidateGeneratedSiteInput
): Promise<ValidateGeneratedSiteResult> {
  const startTime = Date.now();
  const allErrors: string[] = [];
  const logs: string[] = [];

  const preValidation = validateGeneratedFiles(input.files);
  if (preValidation.length > 0) {
    return {
      ok: false,
      tempDir: '',
      logs: 'Pre-build file validation failed',
      errors: preValidation.map((e) => `${e.file}: ${e.error}`),
      durationMs: Date.now() - startTime,
    };
  }

  const safeName = sanitizeProjectName(input.projectName);
  const timestamp = Date.now().toString(36).slice(-6);
  const tempDir = scratchPath('generated-sites', `${safeName}-${timestamp}`);

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    logs.push(`Created temp directory: ${tempDir}`);

    for (const file of input.files) {
      const filePath = path.join(tempDir, file.filePath);
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, file.content, 'utf-8');
    }
    logs.push(`Wrote ${input.files.length} files`);

    for (const required of REQUIRED_FILES) {
      const filePath = path.join(tempDir, required);
      try {
        await fs.promises.access(filePath);
      } catch {
        allErrors.push(`Missing required file: ${required}`);
      }
    }
    if (allErrors.length > 0) {
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }
    logs.push('All required files present');

    const { repaired } = await prepareGeneratedWorkspaceForBuild(tempDir);
    if (repaired.length > 0) {
      logs.push(`Pre-build repairs: ${repaired.join(', ')}`);
      await syncWorkspaceFilesFromDisk(tempDir, input.files);
    }

    const postRepairValidation = validateGeneratedFiles(input.files);
    if (postRepairValidation.length > 0) {
      allErrors.push(...postRepairValidation.map((e) => `${e.file}: ${e.error}`));
      logs.push('Post-repair file validation failed');
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }

    const pageTsxPath = path.join(tempDir, 'src/app/page.tsx');
    const pageTsxContent = await fs.promises.readFile(pageTsxPath, 'utf-8');
    allErrors.push(...checkStringPatterns(pageTsxContent, PAGE_TSX_RUNTIME_BAD_PATTERNS, 'page.tsx'));

    const markdownHeadingPattern = /^#{1,3}\s+\S/m;
    if (markdownHeadingPattern.test(pageTsxContent)) {
      allErrors.push('page.tsx: contains markdown heading artifact in string content');
    }

    if (allErrors.length > 0) {
      logs.push('Runtime string validation failed');
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }
    logs.push('Runtime string validation passed');

    const detectedIndustry = detectIndustryFromContent(pageTsxContent);
    if (detectedIndustry) {
      const templateResult = templateDistinctivenessCheck(pageTsxContent, detectedIndustry);
      if (!templateResult.ok) {
        allErrors.push(`Template distinctiveness check failed: ${templateResult.error}`);
        logs.push(`Template check failed for ${detectedIndustry}: ${templateResult.error}`);
        return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
      }
      logs.push(`Template distinctiveness check passed (${detectedIndustry})`);
    }

    if (!shouldRunLocalNpmBuildGate()) {
      logs.push(
        'Skipped npm install/build on serverless (SITE_AGENT_RUN_BUILD_GATE=1 to force). Static checks passed.'
      );
      return {
        ok: true,
        tempDir,
        logs: logs.join('\n'),
        errors: [],
        durationMs: Date.now() - startTime,
        buildGateSkipped: true,
        files: input.files,
      };
    }

    const npmPath = path.join(getNodeBinDir(), 'npm');

    logs.push('Running npm install...');
    try {
      const dotNext = path.join(tempDir, '.next');
      try {
        await fs.promises.rm(dotNext, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }

      await execFileAsync(npmPath, ['install', '--silent', '--no-audit', '--no-fund'], {
        cwd: tempDir,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          PATH: `${getNodeBinDir()}:${process.env.PATH}`,
          NODE_ENV: 'development',
        },
      });
      logs.push('npm install succeeded');
    } catch (err: unknown) {
      const e = err as { message?: string; stderr?: string; stdout?: string };
      const detail = [e.message, e.stderr, e.stdout].filter(Boolean).join(' | ');
      allErrors.push(`npm install failed: ${detail || 'unknown error'}`);
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }

    logs.push('Running npm run build...');
    try {
      const { stdout, stderr } = await execFileAsync(npmPath, ['run', 'build'], {
        cwd: tempDir,
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          PATH: `${getNodeBinDir()}:${process.env.PATH}`,
          NODE_ENV: 'production',
        },
      });
      logs.push('Build output:');
      logs.push(stdout);
      if (stderr) logs.push('Build stderr:', stderr);
    } catch (err: unknown) {
      const e = err as { message?: string; stderr?: string; stdout?: string };
      allErrors.push(`npm run build failed: ${e.message || 'unknown error'}`);
      if (e.stdout) logs.push('Build stdout:', e.stdout);
      if (e.stderr) logs.push('Build stderr:', e.stderr);
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }

    const durationMs = Date.now() - startTime;
    logs.push(`Validation passed in ${durationMs}ms`);

    return { ok: true, tempDir, logs: logs.join('\n'), errors: [], durationMs, files: input.files };
  } catch (err: unknown) {
    const e = err as Error;
    allErrors.push(`Validation error: ${e.message}`);
    return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
  }
}

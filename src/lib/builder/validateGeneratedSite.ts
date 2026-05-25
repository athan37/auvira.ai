import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

import { getNodeBinDir } from '@/lib/runtime/nodeRuntime';
import { isVercelServerless } from '@/lib/runtime/isVercelServerless';
import { scratchPath } from '@/lib/runtime/scratchDir';

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
  'README.md',
];

const PAGE_TSX_BAD_PATTERNS = [
  '${escapedSiteSpec}',
  'escapedSiteSpec',
  'Cannot find name',
  "from '../agent",
  "from '../../agent",
  '@/lib/agent',
  'process.env',
  'require(',
  'import.meta',
  // HTML injection patterns (forbidden approach)
  'dangerouslySetInnerHTML',
  'contentSectionsHtml',
  'contactSectionHtml',
  '__CONTENT_SECTIONS_HTML__',
  '__CONTACT_SECTION_HTML__',
  'htmlSection',
  // Template placeholder tokens
  '__THEME_PRESET_JSON__',
  '__TEMPLATE_CATEGORY__',
  '__TEMPLATE_VARIANT__',
  // Broken JSX escape syntax
  "{'{'}",
  "{'}",
  "{'{'}$",
];

const SITE_CONFIG_BAD_PATTERNS = [
  '${escapedSiteSpec}',
  '\\${escapedSiteSpec}',
  'contact@example',
  '(555)',
  'Sterling Immigration Law',
];

// Required content checks - data-driven page structure
const PAGE_TSX_REQUIRED = [
  'export default function Home',
  'siteConfig',
  'function SectionRenderer',
  'siteConfig.sections.map',
];

const SITE_CONFIG_REQUIRED = [
  'export const siteConfig',
  'export type SiteConfig',
  'export type SiteSection',
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

/**
 * Auto-detects industry theme from page content based on structural patterns.
 */
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

/**
 * Validates that the generated page content matches structural expectations
 * for the industry template (hero style, required sections, trust signals).
 */
function templateDistinctivenessCheck(
  pageContent: string,
  industryTheme: string
): { ok: boolean; error?: string } {
  const checks: Record<string, () => { ok: boolean; error?: string }> = {
    'legal': () => {
      const hasCredibilityBar = /years|experience|cases|free consultation/i.test(pageContent);
      const hasPracticeAreas = /practice areas?|specialt/i.test(pageContent);
      const hasAttorneySection = /attorney|lawyer|team|about our firm/i.test(pageContent);
      if (!hasCredibilityBar) return { ok: false, error: 'Legal template missing credibility bar with experience/credentials' };
      if (!hasPracticeAreas) return { ok: false, error: 'Legal template missing practice areas section' };
      if (!hasAttorneySection) return { ok: false, error: 'Legal template missing firm/attorneys section' };
      return { ok: true };
    },
    'home-services': () => {
      const hasPhoneNumber = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(pageContent);
      const hasEmergencyBanner = /24\/7|emergency|same.day/i.test(pageContent);
      const hasServiceArea = /service area|coverage|zip|serving/i.test(pageContent);
      if (!hasPhoneNumber) return { ok: false, error: 'Home services template must have phone number prominently displayed' };
      if (!hasEmergencyBanner) return { ok: false, error: 'Home services template missing 24/7 emergency messaging' };
      if (!hasServiceArea) return { ok: false, error: 'Home services template missing service area section' };
      return { ok: true };
    },
    'restaurant': () => {
      const hasHours = /hours|open|closed|monday|tuesday|thursday|friday|saturday|sunday/i.test(pageContent);
      const hasMenu = /menu|dishes|appetizer|entree|dessert|food/i.test(pageContent);
      const hasReservationCta = /reserve|order|book/i.test(pageContent);
      if (!hasHours) return { ok: false, error: 'Restaurant template missing hours information' };
      if (!hasMenu) return { ok: false, error: 'Restaurant template missing menu or featured dishes section' };
      if (!hasReservationCta) return { ok: false, error: 'Restaurant template missing reservation or order CTA' };
      return { ok: true };
    },
    'healthcare': () => {
      const hasAppointmentCta = /appointment|book|schedule|call today/i.test(pageContent);
      const hasInsurance = /insurance|accepted|payment|coverage/i.test(pageContent);
      const hasProviders = /doctor|physician|provider|nurse|medical team/i.test(pageContent);
      if (!hasAppointmentCta) return { ok: false, error: 'Healthcare template must have prominent appointment CTA' };
      if (!hasInsurance) return { ok: false, error: 'Healthcare template missing insurance or payment info' };
      if (!hasProviders) return { ok: false, error: 'Healthcare template missing provider/staff section' };
      return { ok: true };
    },
  };

  const check = checks[industryTheme];
  if (!check) return { ok: true }; // default/general-service skip
  return check();
}

export async function validateGeneratedSite(
  input: ValidateGeneratedSiteInput
): Promise<ValidateGeneratedSiteResult> {
  const startTime = Date.now();
  const allErrors: string[] = [];
  const logs: string[] = [];

  const safeName = sanitizeProjectName(input.projectName);
  const timestamp = Date.now().toString(36).slice(-6);
  const tempDir = scratchPath('generated-sites', `${safeName}-${timestamp}`);

  try {
    // 1. Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    logs.push(`Created temp directory: ${tempDir}`);

    // 2. Write all files
    for (const file of input.files) {
      const filePath = path.join(tempDir, file.filePath);
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, file.content, 'utf-8');
    }
    logs.push(`Wrote ${input.files.length} files`);

    // 3. Verify required files exist
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

    // 4. Run string validation
    const pageTsxPath = path.join(tempDir, 'src/app/page.tsx');
    const siteConfigPath = path.join(tempDir, 'src/lib/siteConfig.ts');
    const pageTsxContent = await fs.promises.readFile(pageTsxPath, 'utf-8');
    const siteConfigContent = await fs.promises.readFile(siteConfigPath, 'utf-8');

    // Check for unsafe patterns
    const pageErrors = checkStringPatterns(pageTsxContent, PAGE_TSX_BAD_PATTERNS, 'page.tsx');
    const configErrors = checkStringPatterns(siteConfigContent, SITE_CONFIG_BAD_PATTERNS, 'siteConfig.ts');
    allErrors.push(...pageErrors, ...configErrors);

    // Check for markdown heading artifacts in page.tsx string literals
    const markdownHeadingPattern = /^#{1,3}\s+\S/m;
    if (markdownHeadingPattern.test(pageTsxContent)) {
      allErrors.push('page.tsx: contains markdown heading artifact in string content');
    }

    // Check for required content
    for (const required of PAGE_TSX_REQUIRED) {
      if (!pageTsxContent.includes(required)) {
        allErrors.push(`page.tsx missing required content: "${required}"`);
      }
    }
    for (const required of SITE_CONFIG_REQUIRED) {
      if (!siteConfigContent.includes(required)) {
        allErrors.push(`siteConfig.ts missing required content: "${required}"`);
      }
    }

    if (allErrors.length > 0) {
      logs.push('String validation failed');
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
    }
    logs.push('String validation passed');

    // 4b. Template distinctiveness check
    const detectedIndustry = detectIndustryFromContent(pageTsxContent);
    if (detectedIndustry) {
      const templateResult = templateDistinctivenessCheck(pageTsxContent, detectedIndustry);
      if (!templateResult.ok) {
        allErrors.push(`Template distinctiveness check failed: ${templateResult.error}`);
        logs.push(`Template check failed for ${detectedIndustry}: ${templateResult.error}`);
      } else {
        logs.push(`Template distinctiveness check passed (${detectedIndustry})`);
      }
    }

    if (allErrors.length > 0) {
      return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
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
      };
    }

    // 5. Run npm install and build (local / long-running hosts only)
    const npmPath = path.join(getNodeBinDir(), 'npm');

    logs.push('Running npm install...');
    try {
      // Clean any residual .next from parent environment
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

    return { ok: true, tempDir, logs: logs.join('\n'), errors: [], durationMs };
  } catch (err: unknown) {
    const e = err as Error;
    allErrors.push(`Validation error: ${e.message}`);
    return { ok: false, tempDir, logs: logs.join('\n'), errors: allErrors, durationMs: Date.now() - startTime };
  }
}
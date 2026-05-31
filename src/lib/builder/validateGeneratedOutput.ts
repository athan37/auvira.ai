import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { rendererComponentForSectionType } from '@/lib/project-workspace/edit-shared/legacySectionPresentation';
import { sectionRendererUsesPresentationResolver } from '@/lib/project-workspace/previewReflectsSiteConfig';
import { customerSiteTailwindConfigIsComplete } from '@/lib/builder/tailwindPresentationSupport';
import { containsMarkdownHeadings } from '@/lib/builder/cleanGeneratedCopy';
import type { GeneratedFile } from '@/lib/builder/types';

export interface GeneratedValidationError {
  file: string;
  error: string;
}

const PAGE_TSX_ESCAPED_PATTERNS = [
  { pattern: '\\${', name: 'escaped template interpolation' },
  { pattern: 'escapedSiteSpec', name: 'escaped site spec reference' },
  { pattern: 'designBrief', name: 'designBrief reference' },
  { pattern: 'isLegal', name: 'isLegal conditional' },
  { pattern: "t('navText'", name: 'theme function call' },
  { pattern: 't("navText"', name: 'theme function call' },
  { pattern: "t('navBg'", name: 'theme function call' },
  { pattern: 't("navBg"', name: 'theme function call' },
  { pattern: "t('primaryButton'", name: 'theme function call' },
  { pattern: 't("primaryButton"', name: 'theme function call' },
];

const PAGE_TSX_STRUCTURAL = [
  'export default function Home',
  'function SectionRenderer',
  'siteConfig.sections.map',
  'import { siteConfig }',
];

const PAGE_TSX_FORBIDDEN = [
  'dangerouslySetInnerHTML',
  'contentSectionsHtml',
  'contactSectionHtml',
  '__CONTENT_SECTIONS_HTML__',
  '__CONTACT_SECTION_HTML__',
  'htmlSection',
  '__THEME_PRESET_JSON__',
  '__TEMPLATE_CATEGORY__',
  '__TEMPLATE_VARIANT__',
  '\\${',
  'escapedSiteSpec',
  '{htmlSection}',
];

const SITE_CONFIG_BAD_PATTERNS = [
  '${escapedSiteSpec}',
  '\\${escapedSiteSpec}',
];

/** Read generated file content by repo-relative path. */
export function getGeneratedFileContent(files: GeneratedFile[], filePath: string): string | undefined {
  return files.find((file) => file.filePath === filePath)?.content;
}

function parseModuleExportsLiteral(content: string): void {
  const literal = content.replace(/^[\s\S]*?module\.exports\s*=\s*/, '').replace(/;\s*$/, '');
  new Function(`return (${literal})`)();
}

/** Standard section renderers must read siteConfig.presentation via resolveSectionBackground. */
export function checkGeneratedSectionPresentationWiring(
  pageContent: string,
  siteConfigContent: string
): string[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const sectionTypes = new Set(
    (parsed?.sections ?? []).map((section) =>
      String((section as { type?: string }).type ?? 'generic').toLowerCase()
    )
  );
  if (sectionTypes.size === 0) return [];

  const errors: string[] = [];
  for (const type of sectionTypes) {
    const component = rendererComponentForSectionType(type);
    if (!sectionRendererUsesPresentationResolver(pageContent, component)) {
      errors.push(
        `src/app/page.tsx: ${component} must use resolveSectionBackground(section, preset) for section presentation`
      );
    }
  }
  return errors;
}

export function validateGeneratedPackageJson(content: string | undefined): GeneratedValidationError[] {
  const errors: GeneratedValidationError[] = [];
  if (!content) {
    errors.push({ file: 'package.json', error: 'Missing file' });
    return errors;
  }
  try {
    const pkg = JSON.parse(content) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };
    if (!pkg.dependencies?.next) {
      errors.push({ file: 'package.json', error: 'Missing next dependency' });
    }
    if (!pkg.scripts?.build) {
      errors.push({ file: 'package.json', error: 'Missing build script' });
    }
  } catch {
    errors.push({ file: 'package.json', error: 'Invalid JSON' });
  }
  return errors;
}

export function validateGeneratedTsConfig(content: string | undefined): GeneratedValidationError[] {
  if (!content) {
    return [{ file: 'tsconfig.json', error: 'Missing file' }];
  }
  try {
    JSON.parse(content);
    return [];
  } catch {
    return [{ file: 'tsconfig.json', error: 'Invalid JSON' }];
  }
}

export function validateGeneratedCommonJsConfig(
  filePath: string,
  content: string | undefined
): GeneratedValidationError[] {
  if (!content) {
    return [{ file: filePath, error: 'Missing file' }];
  }
  if (!content.includes('module.exports')) {
    return [{ file: filePath, error: 'Must use CommonJS (module.exports)' }];
  }
  return [];
}

export function validateGeneratedTailwindConfig(content: string | undefined): GeneratedValidationError[] {
  const errors = validateGeneratedCommonJsConfig('tailwind.config.js', content);
  if (errors.length > 0 || !content) {
    return errors;
  }
  try {
    parseModuleExportsLiteral(content);
  } catch {
    errors.push({ file: 'tailwind.config.js', error: 'Invalid JavaScript object literal' });
    return errors;
  }
  if (!customerSiteTailwindConfigIsComplete(content)) {
    errors.push({
      file: 'tailwind.config.js',
      error: 'Missing full src content scan (./src/**/*) and/or presentation safelist',
    });
  }
  return errors;
}

export function validateGeneratedPageTsx(content: string | undefined): GeneratedValidationError[] {
  const errors: GeneratedValidationError[] = [];
  if (!content) {
    errors.push({ file: 'src/app/page.tsx', error: 'Missing file' });
    return errors;
  }

  for (const { pattern, name } of PAGE_TSX_ESCAPED_PATTERNS) {
    if (content.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Contains ${name}: "${pattern}"` });
    }
  }

  for (const pattern of PAGE_TSX_STRUCTURAL) {
    if (!content.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Missing ${pattern}` });
    }
  }

  for (const pattern of PAGE_TSX_FORBIDDEN) {
    if (content.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Contains forbidden pattern: ${pattern}` });
    }
  }

  if (containsMarkdownHeadings(content)) {
    errors.push({ file: 'src/app/page.tsx', error: 'Markdown heading artifacts found in generated page' });
  }

  if (/<p className="text-slate-600 italic">"\{item\.description/.test(content)) {
    errors.push({
      file: 'src/app/page.tsx',
      error: 'Testimonials use unescaped JSX quote entities; use &ldquo;/&rdquo;',
    });
  }

  return errors;
}

export function validateGeneratedSiteConfigTs(content: string | undefined): GeneratedValidationError[] {
  const errors: GeneratedValidationError[] = [];
  if (!content) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Missing file' });
    return errors;
  }

  for (const pattern of SITE_CONFIG_BAD_PATTERNS) {
    if (content.includes(pattern)) {
      errors.push({ file: 'src/lib/siteConfig.ts', error: `Contains unsafe pattern "${pattern}"` });
    }
  }

  if (!content.includes('export const siteConfig')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Missing export const siteConfig' });
  }
  if (!content.includes('export type SiteConfig')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Missing export type SiteConfig' });
  }

  if (/:\s*undefined\b/.test(content) || /:\s*null\b/.test(content)) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Contains undefined or null property values' });
  }

  return errors;
}

/** Validate the actual GeneratedFile[] produced by generateWebsiteFiles. */
export function validateGeneratedFileSet(files: GeneratedFile[]): GeneratedValidationError[] {
  const errors: GeneratedValidationError[] = [];

  errors.push(...validateGeneratedPackageJson(getGeneratedFileContent(files, 'package.json')));
  errors.push(...validateGeneratedTsConfig(getGeneratedFileContent(files, 'tsconfig.json')));
  errors.push(
    ...validateGeneratedCommonJsConfig('postcss.config.js', getGeneratedFileContent(files, 'postcss.config.js'))
  );
  errors.push(
    ...validateGeneratedCommonJsConfig('next.config.js', getGeneratedFileContent(files, 'next.config.js'))
  );
  errors.push(...validateGeneratedTailwindConfig(getGeneratedFileContent(files, 'tailwind.config.js')));

  const pageContent = getGeneratedFileContent(files, 'src/app/page.tsx');
  const siteConfigContent = getGeneratedFileContent(files, 'src/lib/siteConfig.ts');
  errors.push(...validateGeneratedPageTsx(pageContent));
  errors.push(...validateGeneratedSiteConfigTs(siteConfigContent));

  if (pageContent && siteConfigContent) {
    for (const message of checkGeneratedSectionPresentationWiring(pageContent, siteConfigContent)) {
      errors.push({ file: 'src/app/page.tsx', error: message.replace(/^src\/app\/page\.tsx: /, '') });
    }
  }

  return errors;
}

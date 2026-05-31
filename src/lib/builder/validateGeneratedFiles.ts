import type { SiteSpec } from '../agent/schemas';
import { getIndustryTheme } from './templates';
import type { IndustryTheme } from './templates';
import {
  generatePackageJson,
  generateTailwindConfig,
  generatePostcssConfig,
  generateTsConfig,
  generateNextConfig,
  generateGitLabCiYml,
  generateSiteConfig,
  generateLayoutTsx,
  generateGlobalsCss,
  generatePageTsx,
  generateReadme,
} from './templates';
import { getPreset } from './themePresets';
import { containsTemplateTokens, containsMarkdownHeadings } from './cleanGeneratedCopy';

interface ValidationError {
  file: string;
  error: string;
}

/**
 * Validates generated files before they're committed to GitLab.
 * Catches common issues that would cause Vercel deployment to fail.
 */
export function validateGeneratedFiles(siteSpec: SiteSpec, projectName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate package.json
  try {
    const pkg = JSON.parse(generatePackageJson(projectName));
    if (!pkg.dependencies?.next) {
      errors.push({ file: 'package.json', error: 'Missing next dependency' });
    }
    if (!pkg.scripts?.build) {
      errors.push({ file: 'package.json', error: 'Missing build script' });
    }
  } catch (e) {
    errors.push({ file: 'package.json', error: 'Invalid JSON' });
  }

  // Validate tsconfig.json
  try {
    JSON.parse(generateTsConfig());
  } catch (e) {
    errors.push({ file: 'tsconfig.json', error: 'Invalid JSON' });
  }

  // Validate postcss.config.js - must be valid CommonJS module.exports
  const postcssContent = generatePostcssConfig();
  if (!postcssContent.includes('module.exports')) {
    errors.push({ file: 'postcss.config.js', error: 'Must use CommonJS (module.exports)' });
  }

  // Validate next.config.js - must be valid CommonJS module.exports
  const nextConfigContent = generateNextConfig();
  if (!nextConfigContent.includes('module.exports')) {
    errors.push({ file: 'next.config.js', error: 'Must use CommonJS (module.exports)' });
  }

  // Validate tailwind.config.js - must be valid CommonJS module.exports
  const tailwindContent = generateTailwindConfig();
  if (!tailwindContent.includes('module.exports')) {
    errors.push({ file: 'tailwind.config.js', error: 'Must use CommonJS (module.exports)' });
  } else {
    try {
      const literal = tailwindContent.replace(/^[\s\S]*?module\.exports\s*=\s*/, '').replace(/;\s*$/, '');
      new Function(`return (${literal})`)();
    } catch {
      errors.push({ file: 'tailwind.config.js', error: 'Invalid JavaScript object literal' });
    }
  }

  // Validate page.tsx - check for template literal escaping issues
  const preset = getPreset('modern-clean');
  const presetJson = JSON.stringify(preset);
  const pageContent = generatePageTsx(siteSpec, undefined, undefined, presetJson);

  // NEW: Strict validation for escaped template literal patterns
  // Only flag actual theme function patterns like t('navText', industryTheme) or t("navText", theme)
  const escapedPatterns = [
    { pattern: '\\${', name: 'escaped template interpolation' },
    { pattern: 'escapedSiteSpec', name: 'escaped site spec reference' },
    { pattern: 'designBrief', name: 'designBrief reference' },
    { pattern: 'isLegal', name: 'isLegal conditional' },
    // More specific pattern for theme function - look for t(' or t(" followed by a theme name
    { pattern: "t('navText'", name: 'theme function call' },
    { pattern: 't("navText"', name: 'theme function call' },
    { pattern: "t('navBg'", name: 'theme function call' },
    { pattern: 't("navBg"', name: 'theme function call' },
    { pattern: "t('primaryButton'", name: 'theme function call' },
    { pattern: 't("primaryButton"', name: 'theme function call' },
  ];

  for (const { pattern, name } of escapedPatterns) {
    if (pageContent.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Contains ${name}: "${pattern}"` });
    }
  }

  // Verify positive patterns exist
  if (!pageContent.includes('export default function Home')) {
    errors.push({ file: 'src/app/page.tsx', error: 'Missing export default function Home' });
  }
  if (!pageContent.includes('siteConfig')) {
    errors.push({ file: 'src/app/page.tsx', error: 'Missing siteConfig import' });
  }

  // Block template placeholder tokens
  const pageStructuralChecks = [
    { pattern: 'export default function Home', name: 'export default function Home' },
    { pattern: 'function SectionRenderer', name: 'SectionRenderer function' },
    { pattern: 'siteConfig.sections.map', name: 'siteConfig.sections.map' },
    { pattern: 'import { siteConfig }', name: 'siteConfig import' },
  ];
  for (const { pattern, name } of pageStructuralChecks) {
    if (!pageContent.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Missing ${name}` });
    }
  }

  // Block HTML injection patterns (the old broken approach)
  const htmlInjectionPatterns = [
    { pattern: 'dangerouslySetInnerHTML', name: 'dangerouslySetInnerHTML' },
    { pattern: 'contentSectionsHtml', name: 'contentSectionsHtml' },
    { pattern: 'contactSectionHtml', name: 'contactSectionHtml' },
    { pattern: '__CONTENT_SECTIONS_HTML__', name: '__CONTENT_SECTIONS_HTML__' },
    { pattern: '__CONTACT_SECTION_HTML__', name: '__CONTACT_SECTION_HTML__' },
    { pattern: 'htmlSection', name: 'htmlSection' },
  ];
  for (const { pattern, name } of htmlInjectionPatterns) {
    if (pageContent.includes(pattern)) {
      errors.push({ file: 'src/app/page.tsx', error: `Contains forbidden pattern: ${name}` });
    }
  }

  // Block template placeholder tokens
  const placeholderTokens = [
    '__THEME_PRESET_JSON__',
    '__TEMPLATE_CATEGORY__',
    '__TEMPLATE_VARIANT__',
    '\\${',
    'escapedSiteSpec',
    '{htmlSection}',
  ];
  for (const token of placeholderTokens) {
    if (pageContent.includes(token)) {
      errors.push({ file: 'src/app/page.tsx', error: `Unresolved template placeholder: "${token}"` });
    }
  }

  // Block markdown heading artifacts in page.tsx
  if (containsMarkdownHeadings(pageContent)) {
    errors.push({ file: 'src/app/page.tsx', error: 'Markdown heading artifacts found in generated page' });
  }

  // Validate siteConfig.ts
  const siteConfigValidation = generateSiteConfig(siteSpec);
  if (siteConfigValidation.includes('undefined') || siteConfigValidation.includes('null')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Contains undefined or null values' });
  }
  if (siteConfigValidation.includes('${escapedSiteSpec}') || siteConfigValidation.includes('\\${escapedSiteSpec}')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Contains escaped template literal: ${escapedSiteSpec}' });
  }
  // Verify siteConfig.ts has proper structure
  if (!siteConfigValidation.includes('export const siteConfig')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Missing export const siteConfig' });
  }
  if (!siteConfigValidation.includes('export type SiteConfig')) {
    errors.push({ file: 'src/lib/siteConfig.ts', error: 'Missing export type SiteConfig' });
  }

  return errors;
}

/**
 * Validates that the generated page content matches structural expectations
 * for the industry template (hero style, required sections, trust signals).
 */
export function templateDistinctivenessCheck(
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
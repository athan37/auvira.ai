import type { SiteSpec, DesignBrief } from '../agent/schemas';
import type { GeneratedFile, GenerateWebsiteFilesResult } from './types';
import {
  generatePackageJson,
  generateTailwindConfig,
  generatePostcssConfig,
  generateTsConfig,
  generateNextConfig,
  generateSiteConfig,
  generateLayoutTsx,
  generateGlobalsCss,
  generatePageTsx,
  generateReadme,
  getIndustryTheme,
} from './templates';
import { getPreset } from './themePresets';
import { cleanGeneratedCopy } from './cleanGeneratedCopy';
import { normalizeSiteSpec } from './normalizeSiteSpec';
import { pickBackgroundColor } from './cssColor';
import type { TemplateSelection } from '../agent/selectTemplateAgent';
import { instrumentGeneratedFiles } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';
import type { LayoutStarter } from './layoutStarters';
import { applyLayoutStrategyToPreset } from './layoutStarters';

export function generateWebsiteFiles(
  siteSpec: SiteSpec,
  projectName: string,
  designBrief?: DesignBrief,
  template?: TemplateSelection,
  layoutStarter?: LayoutStarter
): GenerateWebsiteFilesResult {
  // Clean siteSpec to remove any markdown artifacts before generating files
  const cleanedSiteSpec = normalizeSiteSpec(cleanGeneratedCopy(siteSpec) as SiteSpec);

  // Color theme comes from template selection; layout starter only affects structure/hero.
  const variant = template?.variant ?? layoutStarter?.variant ?? 'modern-clean';
  const basePreset = getPreset(variant);
  const preset = applyLayoutStrategyToPreset(
    { ...basePreset, heroStyle: layoutStarter?.heroStyle ?? 'split' },
    layoutStarter
  );

  const customBg = pickBackgroundColor(cleanedSiteSpec.designDirection?.colors);
  if (cleanedSiteSpec.designDirection?.colors?.length) {
    preset.pageBg = `bg-[${customBg}]`;
    preset.surfaceBg = `bg-[${customBg}]`;
  }

  // Build preset JSON for injection into page.tsx
  const presetJson = JSON.stringify(preset);

  const theme = getIndustryTheme(designBrief);
  const files: GeneratedFile[] = [
    {
      filePath: 'package.json',
      content: generatePackageJson(projectName),
    },
    {
      filePath: 'tailwind.config.js',
      content: generateTailwindConfig(designBrief),
    },
    {
      filePath: 'postcss.config.js',
      content: generatePostcssConfig(),
    },
    {
      filePath: 'tsconfig.json',
      content: generateTsConfig(),
    },
    {
      filePath: 'next.config.js',
      content: generateNextConfig(),
    },
    {
      filePath: 'src/lib/siteConfig.ts',
      content: generateSiteConfig(cleanedSiteSpec),
    },
    {
      filePath: 'src/app/layout.tsx',
      content: generateLayoutTsx(),
    },
    {
      filePath: 'src/app/globals.css',
      content: generateGlobalsCss(designBrief, cleanedSiteSpec.designDirection?.colors),
    },
    {
      filePath: 'src/app/page.tsx',
      content: generatePageTsx(cleanedSiteSpec, designBrief, theme, presetJson),
    },
    {
      filePath: 'README.md',
      content: generateReadme(projectName, cleanedSiteSpec),
    },
  ];

  const instrumented = instrumentGeneratedFiles(files);

  return {
    files: instrumented.files,
    analytics: {
      publicSiteKey: instrumented.publicSiteKey,
    },
    summary: {
      fileCount: instrumented.files.length,
      sections: cleanedSiteSpec.sections.map(s => s.title),
    },
  };
}
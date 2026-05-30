import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { extractSectionComponentSource } from './resolveSectionTarget';
import { normalizeCustomerSiteTailwindConfig, repairTailwindConfigInWorkspace } from '@/lib/builder/tailwindPresentationSupport';
import { sanitizeSourceForPublish } from '@/lib/site-manager/siteConfigAgentMarkers';
import {
  PAGE_TSX,
  SITE_CONFIG,
  TAILWIND_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from './strategyContext';
import type { WebsiteEditAgentOptions } from './types';

const TYPE_TO_COMPONENT: Record<string, string> = {
  services: 'ServicesSection',
  about: 'AboutSection',
  testimonials: 'TestimonialsSection',
  testimonial: 'TestimonialsSection',
  faq: 'FaqSection',
  gallery: 'GallerySection',
  generic: 'GenericSection',
  contact: 'ContactSection',
  features: 'FeaturesSection',
};

export function rendererComponentForSectionType(type: string): string {
  const normalized = type.toLowerCase();
  return TYPE_TO_COMPONENT[normalized] ?? `${normalized.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())}Section`;
}

const PRESET_BG_TAILWIND = /\+\s*preset\.(mutedBg|surfaceBg|contactBg|pageBg)/g;

/**
 * True when a section component still reads preset.* for its outer background.
 */
export function sectionComponentUsesPresetBackground(
  pageContent: string,
  componentName: string
): boolean {
  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return false;
  if (extracted.content.includes('resolveSectionBackground')) return false;
  return PRESET_BG_TAILWIND.test(extracted.content);
}

function injectPresentationRuntime(pageContent: string): string {
  if (pageContent.includes('function resolveSectionBackground')) {
    return pageContent;
  }
  const firstFunction = pageContent.search(/\nfunction [A-Z]/);
  const insertAt = firstFunction >= 0 ? firstFunction + 1 : 0;
  return (
    pageContent.slice(0, insertAt) +
    `\n${SECTION_PRESENTATION_RUNTIME}\n` +
    pageContent.slice(insertAt)
  );
}

/**
 * Wire a legacy section renderer to siteConfig.sections[].presentation.
 */
export function upgradeSectionComponentToPresentationResolver(
  pageContent: string,
  componentName: string
): { content: string; patched: boolean } {
  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return { content: pageContent, patched: false };
  if (extracted.content.includes('resolveSectionBackground')) {
    return { content: pageContent, patched: false };
  }

  const patchedBody = extracted.content.replace(
    PRESET_BG_TAILWIND,
    '+ resolveSectionBackground(section, preset)'
  );
  if (patchedBody === extracted.content) {
    return { content: pageContent, patched: false };
  }

  const start = pageContent.indexOf(extracted.content);
  if (start < 0) return { content: pageContent, patched: false };

  let content =
    pageContent.slice(0, start) + patchedBody + pageContent.slice(start + extracted.content.length);
  content = injectPresentationRuntime(content);
  return { content, patched: true };
}

/**
 * Ensure tailwind.config.js scans siteConfig and safelists agent-driven presentation classes.
 */
export async function ensureTailwindPresentationSupport(
  options: WebsiteEditAgentOptions
): Promise<boolean> {
  const tailwindContent = await readWorkspaceRel(options, TAILWIND_CONFIG);
  if (!tailwindContent) return false;

  const { content: patched, changed } = normalizeCustomerSiteTailwindConfig(tailwindContent);
  if (!changed) return false;

  await writeWorkspaceRel(options, TAILWIND_CONFIG, patched);
  return true;
}

/**
 * On legacy page.tsx files, wire the target section renderer to siteConfig.presentation.
 */
export async function ensureLegacyPageReadsPresentation(
  options: WebsiteEditAgentOptions,
  componentName: string
): Promise<boolean> {
  let changed = await ensureTailwindPresentationSupport(options);

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent || !sectionComponentUsesPresetBackground(pageContent, componentName)) {
    return changed;
  }

  const upgraded = upgradeSectionComponentToPresentationResolver(pageContent, componentName);
  if (!upgraded.patched) return changed;

  await writeWorkspaceRel(
    options,
    PAGE_TSX,
    sanitizeSourceForPublish(PAGE_TSX, upgraded.content)
  );
  return true;
}

/**
 * Wire all section renderers in page.tsx that still use preset backgrounds,
 * and repair tailwind.config.js safelist. Used on preview bootstrap and after style edits.
 */
export async function repairSectionPresentationWiringInWorkspace(
  workspacePath: string,
  readWrite?: {
    read: (rel: string) => Promise<string | null>;
    write: (rel: string, content: string) => Promise<void>;
  }
): Promise<string[]> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  const { parseSiteConfigSource } = await import('@/lib/site-manager/siteConfigParser');
  const repaired: string[] = [];

  const readRel = async (rel: string): Promise<string | null> => {
    if (readWrite) return readWrite.read(rel);
    try {
      return await fs.readFile(path.join(workspacePath, rel), 'utf-8');
    } catch {
      return null;
    }
  };
  const writeRel = async (rel: string, content: string): Promise<void> => {
    if (readWrite) {
      await readWrite.write(rel, content);
      return;
    }
    const dest = path.join(workspacePath, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content, 'utf-8');
  };

  const tailwindChanged = readWrite
    ? await (async () => {
        const tailwind = await readRel(TAILWIND_CONFIG);
        if (!tailwind) return false;
        const { content: patched, changed } = normalizeCustomerSiteTailwindConfig(tailwind);
        if (!changed) return false;
        await writeRel(TAILWIND_CONFIG, patched);
        return true;
      })()
    : await repairTailwindConfigInWorkspace(workspacePath);
  if (tailwindChanged) repaired.push('tailwind.config.js');

  let pageContent = await readRel(PAGE_TSX);
  const siteConfig = await readRel(SITE_CONFIG);
  if (!pageContent || !siteConfig) {
    return repaired;
  }

  const parsed = parseSiteConfigSource(siteConfig);
  const sectionTypes = new Set(
    (parsed?.sections ?? []).map((s) => String((s as { type?: string }).type ?? ''))
  );
  if (sectionTypes.size === 0) {
    sectionTypes.add('gallery');
    sectionTypes.add('services');
    sectionTypes.add('testimonials');
    sectionTypes.add('about');
    sectionTypes.add('contact');
  }

  let pageChanged = false;
  for (const type of sectionTypes) {
    if (!type) continue;
    const component = rendererComponentForSectionType(type);
    const upgraded = upgradeSectionComponentToPresentationResolver(pageContent, component);
    if (upgraded.patched) {
      pageContent = upgraded.content;
      pageChanged = true;
    }
  }

  if (pageChanged) {
    await writeRel(
      PAGE_TSX,
      sanitizeSourceForPublish(PAGE_TSX, pageContent)
    );
    repaired.push('src/app/page.tsx');
  }

  return repaired;
}

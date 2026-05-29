import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { extractSectionComponentSource } from './resolveSectionTarget';
import { normalizeCustomerSiteTailwindConfig } from '@/lib/builder/tailwindPresentationSupport';
import {
  PAGE_TSX,
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

  await writeWorkspaceRel(options, PAGE_TSX, upgraded.content);
  return true;
}

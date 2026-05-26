import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { wantsNewImageSection } from './imagePlacementIntent';

export interface SiteSectionSummary {
  index: number;
  type: string;
  title: string;
  hasImageItems: boolean;
  imageItemCount: number;
  itemCount: number;
}

export interface SiteStructureSnapshot {
  sections: SiteSectionSummary[];
  sectionTypesInConfig: string[];
  sectionTypesInPage: string[];
  rendersFromSiteConfig: boolean;
  hasGalleryRenderer: boolean;
  hasGenericRenderer: boolean;
  defaultRendersNull: boolean;
  heroHasImageSlot: boolean;
}

function extractSectionTypesFromPage(pageContent: string): string[] {
  const types = new Set<string>();
  const casePattern = /case\s*['"]([a-z_]+)['"]/gi;
  let m: RegExpExecArray | null;
  while ((m = casePattern.exec(pageContent)) !== null) {
    types.add(m[1].toLowerCase());
  }
  return [...types];
}

function sectionHasImages(
  items?: Array<{ title?: string; description?: string; imageUrl?: string }>
): { has: boolean; count: number } {
  if (!items?.length) return { has: false, count: 0 };
  const withUrl = items.filter(
    (i) => typeof (i as { imageUrl?: string }).imageUrl === 'string' && (i as { imageUrl: string }).imageUrl.length > 0
  );
  return { has: withUrl.length > 0, count: withUrl.length };
}

/**
 * Deterministic snapshot of how this site's homepage is structured (config + page renderers).
 */
export function analyzeSiteStructureForImages(
  siteConfigContent: string,
  pageContent: string
): SiteStructureSnapshot {
  const config = parseSiteConfigSource(siteConfigContent);
  const sections: SiteSectionSummary[] = (config?.sections ?? []).map((s, index) => {
    const img = sectionHasImages(s.items);
    return {
      index,
      type: String(s.type ?? 'generic').toLowerCase(),
      title: String(s.title ?? '').slice(0, 120),
      hasImageItems: img.has,
      imageItemCount: img.count,
      itemCount: s.items?.length ?? 0,
    };
  });

  const sectionTypesInConfig = [...new Set(sections.map((s) => s.type))];
  const sectionTypesInPage = extractSectionTypesFromPage(pageContent);

  return {
    sections,
    sectionTypesInConfig,
    sectionTypesInPage,
    rendersFromSiteConfig: /siteConfig\.sections/.test(pageContent),
    hasGalleryRenderer: /function GallerySection|case\s*['"]gallery['"]/.test(pageContent),
    hasGenericRenderer: /function GenericSection/.test(pageContent),
    defaultRendersNull: /default:\s*return\s*null/.test(pageContent),
    heroHasImageSlot: /<img[\s\S]*?\/uploads\//.test(pageContent.slice(0, 8000)),
  };
}

export function buildStructureBriefForPlanner(snapshot: SiteStructureSnapshot): string {
  const lines: string[] = [
    'Homepage sections (siteConfig.sections, in order):',
  ];

  if (snapshot.sections.length === 0) {
    lines.push('  (none — site may only use hero + hardcoded blocks)');
  } else {
    for (const s of snapshot.sections) {
      lines.push(
        `  [${s.index}] type="${s.type}" title="${s.title}" items=${s.itemCount}${s.hasImageItems ? ` (${s.imageItemCount} with imageUrl)` : ''}`
      );
    }
  }

  lines.push(`Section types wired in page.tsx: ${snapshot.sectionTypesInPage.join(', ') || '(none found)'}`);
  lines.push(`Renders from siteConfig.sections: ${snapshot.rendersFromSiteConfig}`);
  lines.push(`Gallery renderer: ${snapshot.hasGalleryRenderer}`);
  lines.push(`GenericSection fallback: ${snapshot.hasGenericRenderer}`);
  if (snapshot.defaultRendersNull) {
    lines.push('WARNING: SectionRenderer default returns null — unknown section types will not show.');
  }

  return lines.join('\n');
}

/** Best section type to insert after (prefer services → about → features, never faq/contact). */
export function pickPreferredInsertAnchor(snapshot: SiteStructureSnapshot): string | null {
  const preferred = ['services', 'about', 'features', 'testimonials'];
  for (const t of preferred) {
    if (snapshot.sections.some((s) => s.type === t)) {
      return t;
    }
  }
  const skip = new Set(['contact', 'faq', 'gallery', 'generic']);
  const last = [...snapshot.sections].reverse().find((s) => !skip.has(s.type));
  return last?.type ?? null;
}

/** Insert anchor when owner wants a separate gallery (not updating the existing image block). */
function pickInsertAnchorForNewGallery(snapshot: SiteStructureSnapshot): string | null {
  const nonImageSections = snapshot.sections.filter((s) => !s.hasImageItems);
  if (nonImageSections.length > 0) {
    return nonImageSections[nonImageSections.length - 1]!.type;
  }
  return pickPreferredInsertAnchor(snapshot);
}

/** Rule-based fallback when LLM planning is unavailable. */
export function planImagePlacementFallback(
  snapshot: SiteStructureSnapshot,
  ownerMessage: string
): import('./imagePlacementPlan').ImagePlacementPlan {
  const lower = ownerMessage.toLowerCase();
  const existingGallery = snapshot.sections.find((s) => s.hasImageItems);
  const forceNewSection = wantsNewImageSection(ownerMessage);

  if (/\bfirst\s+section\b/i.test(lower) && snapshot.sections.length > 0) {
    const first = snapshot.sections[0];
    return {
      action: 'update_section',
      sectionType: 'gallery',
      targetSectionIndex: 0,
      targetSectionTitle: first.title,
      insertAfterSectionType: null,
      title: first.title || 'Gallery',
      body: undefined,
      reasoning: 'Owner asked to add images to the first section.',
    };
  }

  const introSection = snapshot.sections.find(
    (s) => /\b(introduction|intro)\b/i.test(s.title) || s.type === 'about'
  );
  if (/\b(introduction|intro)\b/.test(lower) && introSection) {
    return {
      action: 'update_section',
      sectionType: 'gallery',
      targetSectionIndex: introSection.index,
      targetSectionTitle: introSection.title,
      insertAfterSectionType: null,
      title: introSection.title || 'Introduction',
      body: undefined,
      reasoning: 'Owner asked to add images to the introduction/about section.',
    };
  }

  if (forceNewSection) {
    let insertAfter: string | null = pickInsertAnchorForNewGallery(snapshot);
    if (/\bafter about\b/.test(lower) && snapshot.sections.some((s) => s.type === 'about')) {
      insertAfter = 'about';
    } else if (
      /\bafter service/.test(lower) &&
      snapshot.sections.some((s) => s.type === 'services')
    ) {
      insertAfter = 'services';
    }
    return {
      action: 'create_section',
      sectionType: 'gallery',
      targetSectionIndex: null,
      targetSectionTitle: null,
      insertAfterSectionType: insertAfter,
      title: 'Our work',
      body: 'Photos from our recent work and products.',
      reasoning: insertAfter
        ? `New gallery section after "${insertAfter}" (owner asked for another section).`
        : 'New gallery section (owner asked for another section).',
    };
  }

  if (existingGallery) {
    return {
      action: 'update_section',
      sectionType: 'gallery',
      targetSectionIndex: existingGallery.index,
      targetSectionTitle: existingGallery.title,
      insertAfterSectionType: null,
      title: existingGallery.title,
      body: undefined,
      reasoning: 'Updating existing section that already contains images.',
    };
  }

  let insertAfter: string | null = pickPreferredInsertAnchor(snapshot);

  if (/\b(hero|top|below hero)\b/.test(lower)) {
    insertAfter = null;
  } else if (/\bafter about\b/.test(lower) && snapshot.sections.some((s) => s.type === 'about')) {
    insertAfter = 'about';
  } else if (/\bafter service/.test(lower) && snapshot.sections.some((s) => s.type === 'services')) {
    insertAfter = 'services';
  }

  const pageType =
    snapshot.hasGalleryRenderer || snapshot.sectionTypesInPage.includes('gallery')
      ? 'gallery'
      : 'gallery';

  return {
    action: 'create_section',
    sectionType: pageType,
    targetSectionIndex: null,
    targetSectionTitle: null,
    insertAfterSectionType: insertAfter,
    title: 'Our work',
    body: 'Photos from our recent work and products.',
    reasoning: insertAfter
      ? `New gallery section after "${insertAfter}" (site has that section).`
      : 'New gallery section at start of sections (no anchor found).',
  };
}

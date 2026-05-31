import {
  parseSiteConfigSource,
  replaceSiteConfigSectionsInSource,
  type ParsedSiteConfig,
} from '@/lib/site-manager/siteConfigParser';

type AnalyticsSection = ParsedSiteConfig['sections'][number] & {
  id?: string;
  analyticsId?: string;
};

export interface EnsureAnalyticsIdsResult {
  content: string;
  changed: boolean;
  sectionIds: string[];
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return slug || 'section';
}

export function stableAnalyticsIdForSection(section: {
  type?: string;
  title?: string;
}, index: number): string {
  const type = slugify(section.type || 'section');
  const title = slugify(section.title || `section-${index + 1}`);
  return `section_${type}_${title}_${index + 1}`;
}

function sectionAnalyticsId(section: AnalyticsSection, index: number): string {
  return (
    (typeof section.analyticsId === 'string' && section.analyticsId.trim()) ||
    (typeof section.id === 'string' && section.id.trim()) ||
    stableAnalyticsIdForSection(section, index)
  );
}

export function ensureAnalyticsIdsInSiteConfig(content: string): EnsureAnalyticsIdsResult {
  const parsed = parseSiteConfigSource(content);
  if (!parsed?.sections?.length) {
    return { content, changed: false, sectionIds: [] };
  }

  let changed = false;
  const sections = parsed.sections.map((section, index) => {
    const current = section as AnalyticsSection;
    const id = sectionAnalyticsId(current, index);
    if (current.analyticsId || current.id) {
      return current;
    }
    changed = true;
    return {
      ...current,
      analyticsId: id,
    };
  });

  if (!changed) {
    return {
      content,
      changed: false,
      sectionIds: sections.map((section, index) => sectionAnalyticsId(section, index)),
    };
  }

  const updated = replaceSiteConfigSectionsInSource(content, sections);
  if (!updated) {
    return { content, changed: false, sectionIds: [] };
  }

  return {
    content: updated,
    changed: true,
    sectionIds: sections.map((section, index) => sectionAnalyticsId(section, index)),
  };
}

export interface FindSectionByAnalyticsIdResult {
  found: boolean;
  sectionIndex?: number;
  section?: AnalyticsSection;
}

/**
 * Resolve a section (or hero) by analyticsId / sectionId from siteConfig source.
 */
export function findSectionByAnalyticsId(
  content: string,
  id: string
): FindSectionByAnalyticsIdResult {
  const normalizedId = id.trim();
  if (!normalizedId) return { found: false };

  if (normalizedId === 'hero') {
    return {
      found: true,
      sectionIndex: -1,
      section: { type: 'hero', title: 'Hero' } as AnalyticsSection,
    };
  }

  const parsed = parseSiteConfigSource(content);
  if (!parsed?.sections?.length) return { found: false };

  const index = parsed.sections.findIndex((section, idx) => {
    const current = section as AnalyticsSection;
    const resolvedId = sectionAnalyticsId(current, idx);
    return (
      (typeof current.analyticsId === 'string' && current.analyticsId === normalizedId) ||
      (typeof current.id === 'string' && current.id === normalizedId) ||
      resolvedId === normalizedId
    );
  });

  if (index < 0) return { found: false };
  return {
    found: true,
    sectionIndex: index,
    section: parsed.sections[index] as AnalyticsSection,
  };
}

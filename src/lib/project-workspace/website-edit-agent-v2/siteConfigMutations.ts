import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  colorNameToBackgroundClass,
  type SiteSectionPresentation,
} from '@/lib/builder/sectionPresentation';

const SITE_CONFIG_EXPORT = /export const siteConfig(?::\s*SiteConfig)?\s*=\s*/;

function findSiteConfigObjectSpan(content: string): { start: number; end: number } | null {
  const match = content.match(SITE_CONFIG_EXPORT);
  if (!match || match.index === undefined) return null;

  let index = match.index + match[0].length;
  while (index < content.length && /\s/.test(content[index]!)) index += 1;
  if (content[index] !== '{') return null;

  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escape = false;
  const start = index;

  for (; index < content.length; index++) {
    const char = content[index]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1 };
      }
    }
  }

  return null;
}

function parseSiteConfigObject(content: string): Record<string, unknown> | null {
  const span = findSiteConfigObjectSpan(content);
  if (!span) return null;

  try {
    const parsed = new Function(`return (${content.slice(span.start, span.end)})`)();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asMutableRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function replaceSiteConfigObject(content: string, config: Record<string, unknown>): string | null {
  const span = findSiteConfigObjectSpan(content);
  if (!span) return null;

  const serialized = JSON.stringify(config, null, 2);
  const updated = `${content.slice(0, span.start)}${serialized}${content.slice(span.end)}`;
  return parseSiteConfigSource(updated) ? updated : null;
}

/**
 * Mutate a parsed siteConfig object and write it back into the original source.
 */
export function mutateSiteConfigSource(
  content: string,
  mutate: (config: Record<string, unknown>) => boolean
): string | null {
  const config = parseSiteConfigObject(content);
  if (!config) return null;

  const changed = mutate(config);
  if (!changed) return null;

  return replaceSiteConfigObject(content, config);
}

/**
 * Update a hero text field in siteConfig.ts source.
 */
export function updateHeroFieldInSource(
  content: string,
  field: string,
  value: string
): string | null {
  const allowed = new Set(['headline', 'subheadline', 'tagline']);
  if (!allowed.has(field) || !value.trim()) return null;

  return mutateSiteConfigSource(content, (config) => {
    const hero = asMutableRecord(config.hero);
    if (hero[field] === value) return false;
    hero[field] = value;
    config.hero = hero;
    return true;
  });
}

/**
 * Update a contact field in siteConfig.ts source.
 */
export function updateContactFieldInSource(
  content: string,
  field: string,
  value: string
): string | null {
  const allowed = new Set(['phone', 'email', 'address']);
  if (!allowed.has(field) || !value.trim()) return null;

  return mutateSiteConfigSource(content, (config) => {
    const contact = asMutableRecord(config.contact);
    if (contact[field] === value) return false;
    contact[field] = value;
    config.contact = contact;
    return true;
  });
}

/**
 * Add a service item to the services section, creating that section if needed.
 */
export function addServiceToSource(
  content: string,
  service: { title: string; description?: string }
): string | null {
  const title = normalizeString(service.title);
  if (!title) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    let services = sections.find((section) => {
      const type = normalizeString(section.type)?.toLowerCase();
      const sectionTitle = normalizeString(section.title)?.toLowerCase();
      return type === 'services' || sectionTitle?.includes('service');
    });

    if (!services) {
      services = { type: 'services', title: 'Services', items: [] };
      sections.push(services);
      config.sections = sections;
    }

    const items = Array.isArray(services.items)
      ? (services.items as Array<Record<string, unknown>>)
      : [];
    const exists = items.some((item) => normalizeString(item.title)?.toLowerCase() === title.toLowerCase());
    if (exists) return false;

    const item: Record<string, unknown> = { title };
    const description = normalizeString(service.description);
    if (description) item.description = description;
    items.push(item);
    services.items = items;
    return true;
  });
}

/**
 * Add a generic config-driven section to siteConfig.ts source.
 */
export function addSectionToSource(
  content: string,
  section: { type?: string; title: string; body?: string; items?: unknown[] }
): string | null {
  const title = normalizeString(section.title);
  if (!title) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const exists = sections.some((existing) => normalizeString(existing.title)?.toLowerCase() === title.toLowerCase());
    if (exists) return false;

    const next: Record<string, unknown> = {
      type: normalizeString(section.type) ?? 'generic',
      title,
    };
    const body = normalizeString(section.body);
    if (body) next.body = body;
    if (Array.isArray(section.items)) next.items = section.items;

    sections.push(next);
    config.sections = sections;
    return true;
  });
}

/**
 * Update presentation tokens on a section by index in siteConfig.ts source.
 */
export function updateSectionPresentationInSource(
  content: string,
  sectionIndex: number,
  presentation: Partial<SiteSectionPresentation>
): string | null {
  if (sectionIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section) return false;

    const current = asMutableRecord(section.presentation);
    let changed = false;

    for (const [key, value] of Object.entries(presentation)) {
      if (value === undefined) continue;
      const normalized =
        typeof value === 'string' && value.trim() ? value.trim() : undefined;
      if (normalized) {
        if (current[key] !== normalized) {
          current[key] = normalized;
          changed = true;
        }
      } else if (key in current) {
        delete current[key];
        changed = true;
      }
    }

    if (!changed) return false;

    section.presentation = Object.keys(current).length > 0 ? current : undefined;
    return true;
  });
}

/**
 * Set a section background from a color name (e.g. "yellow" -> bg-yellow-200).
 */
export function updateSectionBackgroundColorInSource(
  content: string,
  sectionIndex: number,
  colorName: string
): string | null {
  const backgroundClass = colorNameToBackgroundClass(colorName);
  return updateSectionPresentationInSource(content, sectionIndex, { backgroundClass });
}


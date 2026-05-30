import { promises as fs } from 'fs';
import path from 'path';
import {
  ensureSiteConfigTypesSupportGallery,
  ensureSiteConfigTypesSupportPresentation,
} from '@/lib/builder/siteConfigTypes';
import { stripAgentSyncMarkers } from './siteConfigAgentMarkers';

export interface ParsedSiteConfig {
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  businessName?: string;
  sections: Array<{
    id?: string;
    analyticsId?: string;
    type?: string;
    title?: string;
    body?: string;
    items?: Array<{ title?: string; description?: string; imageUrl?: string }>;
  }>;
}

const SITE_CONFIG_REL = 'src/lib/siteConfig.ts';

const SITE_CONFIG_EXPORT =
  /export const siteConfig(?::\s*SiteConfig)?\s*=\s*/;

/** Extract balanced `{ ... }` object literal after siteConfig export. */
export function extractSiteConfigObjectLiteral(content: string): string | null {
  const stripped = stripAgentSyncMarkers(content);
  const m = stripped.match(SITE_CONFIG_EXPORT);
  if (!m || m.index === undefined) return null;

  let i = m.index + m[0].length;
  while (i < stripped.length && /\s/.test(stripped[i]!)) i += 1;
  if (stripped[i] !== '{') return null;

  let depth = 0;
  const start = i;
  let inString: '"' | "'" | null = null;
  let escape = false;

  for (; i < stripped.length; i++) {
    const c = stripped[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inString) {
        inString = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return stripped.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse siteConfig object from workspace siteConfig.ts source.
 */
export function parseSiteConfigSource(content: string): ParsedSiteConfig | null {
  const literal = extractSiteConfigObjectLiteral(content);
  if (!literal) return null;

  try {
    const raw = new Function(`return (${literal})`)() as Record<string, unknown>;
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const contact = (raw.contact as ParsedSiteConfig['contact']) ?? {};
    return {
      businessName:
        typeof raw.businessName === 'string' ? raw.businessName : undefined,
      contact,
      sections: sections as ParsedSiteConfig['sections'],
    };
  } catch {
    return null;
  }
}

export function describeSiteConfigParseFailure(content: string): string {
  const stripped = stripAgentSyncMarkers(content);
  if (!SITE_CONFIG_EXPORT.test(stripped)) {
    return 'siteConfig.ts is missing export const siteConfig = { ... }';
  }
  if (!extractSiteConfigObjectLiteral(content)) {
    return 'siteConfig.ts object literal could not be parsed (syntax or unsupported shape)';
  }
  const config = parseSiteConfigSource(content);
  if (!config) {
    return 'siteConfig.ts parsed but failed validation';
  }
  if (!config.sections?.length) {
    return 'siteConfig.ts has no sections array entries';
  }
  return 'unknown parse failure';
}

/** Find `"sections": [` … matching `]` bounds in source (after strip). */
export function findSectionsArraySpan(
  content: string
): { start: number; end: number } | null {
  const stripped = stripAgentSyncMarkers(content);
  const label = stripped.match(/"sections"\s*:\s*\[/);
  if (!label || label.index === undefined) return null;

  const openBracket = label.index + label[0].length - 1;
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let escape = false;

  for (let i = openBracket; i < stripped.length; i++) {
    const c = stripped[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        return { start: openBracket, end: i + 1 };
      }
    }
  }
  return null;
}

function serializeSectionsArray(sections: ParsedSiteConfig['sections']): string {
  return JSON.stringify(sections, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

/**
 * Replace only the sections array in siteConfig.ts, preserving hero, navigation, and other keys.
 */
export function replaceSiteConfigSectionsInSource(
  original: string,
  sections: ParsedSiteConfig['sections']
): string | null {
  const stripped = stripAgentSyncMarkers(original);
  const span = findSectionsArraySpan(original);
  if (!span) return null;

  const replacement = serializeSectionsArray(sections);
  const updated =
    stripped.slice(0, span.start) + replacement + stripped.slice(span.end);
  return ensureSiteConfigTypesSupportGallery(updated);
}

export async function readSiteConfigFromWorkspace(
  workspacePath: string
): Promise<{ content: string; config: ParsedSiteConfig | null; relPath: string }> {
  const relPath = SITE_CONFIG_REL;
  const fullPath = path.join(workspacePath, relPath);
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    return { content, config: parseSiteConfigSource(content), relPath };
  } catch {
    return { content: '', config: null, relPath };
  }
}

/**
 * Replace contact.phone in siteConfig.ts source.
 */
export function patchSiteConfigPhone(content: string, phone: string): string {
  const parsed = parseSiteConfigSource(content);
  if (!parsed) return content;

  parsed.contact = parsed.contact ?? {};
  parsed.contact.phone = phone;

  return rebuildSiteConfigFile(content, parsed);
}

/**
 * Replace or add hours text in contact section body or first hours-like section.
 */
export function patchSiteConfigHours(content: string, hours: string): string {
  const parsed = parseSiteConfigSource(content);
  if (!parsed) return content;

  let patched = false;
  for (const section of parsed.sections) {
    if (section.type === 'contact' || section.title?.toLowerCase().includes('hour')) {
      section.body = hours;
      patched = true;
      break;
    }
  }
  if (!patched) {
    parsed.sections.push({ type: 'contact', title: 'Hours', body: hours, items: [] });
  }

  return rebuildSiteConfigFile(content, parsed);
}

/**
 * Ensure main service appears in services section or hero subheadline.
 */
export function patchSiteConfigMainService(content: string, service: string): string {
  const parsed = parseSiteConfigSource(content);
  if (!parsed) return content;

  const servicesSection = parsed.sections.find((s) => s.type === 'services');
  if (servicesSection) {
    const items = servicesSection.items ?? [];
    const exists = items.some((i) =>
      (i.title ?? '').toLowerCase().includes(service.toLowerCase())
    );
    if (!exists) {
      servicesSection.items = [{ title: service }, ...items];
    }
  } else {
    parsed.sections.unshift({
      type: 'services',
      title: 'Our Services',
      items: [{ title: service }],
    });
  }

  return rebuildSiteConfigFile(content, parsed);
}

/**
 * Remove section or item matching expired banner text.
 */
export function patchRemoveBanner(content: string, bannerText: string): string {
  const parsed = parseSiteConfigSource(content);
  if (!parsed) return content;

  const needle = bannerText.toLowerCase();
  parsed.sections = parsed.sections.filter((section) => {
    const inTitle = section.title?.toLowerCase().includes(needle);
    const inBody = section.body?.toLowerCase().includes(needle);
    return !inTitle && !inBody;
  });

  return rebuildSiteConfigFile(content, parsed);
}

/** Write parsed config back into siteConfig.ts preserving export style (fallback; drops unmodeled keys). */
export function rebuildSiteConfigFile(original: string, config: ParsedSiteConfig): string {
  const stripped = stripAgentSyncMarkers(original);
  const json = JSON.stringify(config, null, 2);
  const m = stripped.match(SITE_CONFIG_EXPORT);
  if (!m || m.index === undefined) return ensureSiteConfigTypesSupportGallery(original);

  const literal = extractSiteConfigObjectLiteral(original);
  if (!literal) return ensureSiteConfigTypesSupportGallery(original);

  const objStart = m.index + m[0].length;
  let i = objStart;
  while (i < stripped.length && /\s/.test(stripped[i]!)) i += 1;
  const objectEnd = i + literal.length;
  let tail = stripped.slice(objectEnd);
  if (tail.startsWith(';')) tail = tail.slice(1);

  const typed = /export const siteConfig:\s*SiteConfig\s*=/.test(
    stripped.slice(m.index, m.index + 60)
  );
  const prefix = typed
    ? 'export const siteConfig: SiteConfig = '
    : 'export const siteConfig = ';
  const rebuilt = `${stripped.slice(0, m.index)}${prefix}${json};${tail}`;
  return ensureSiteConfigTypesSupportGallery(rebuilt);
}

export { SITE_CONFIG_REL };

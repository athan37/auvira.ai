import { promises as fs } from 'fs';
import path from 'path';

export interface ParsedSiteConfig {
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  businessName?: string;
  sections: Array<{
    type?: string;
    title?: string;
    body?: string;
    items?: Array<{ title?: string; description?: string; imageUrl?: string }>;
  }>;
}

const SITE_CONFIG_REL = 'src/lib/siteConfig.ts';

/**
 * Parse siteConfig object from workspace siteConfig.ts source.
 */
export function parseSiteConfigSource(content: string): ParsedSiteConfig | null {
  const match =
    content.match(/export const siteConfig:\s*SiteConfig\s*=\s*(\{[\s\S]*\});?\s*$/) ??
    content.match(/export const siteConfig\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match?.[1]) return null;

  try {
    const config = new Function(`return (${match[1]})`)() as ParsedSiteConfig;
    return config;
  } catch {
    return null;
  }
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

/** Write parsed config back into siteConfig.ts preserving export style. */
export function rebuildSiteConfigFile(original: string, config: ParsedSiteConfig): string {
  const json = JSON.stringify(config, null, 2);
  if (/export const siteConfig:\s*SiteConfig\s*=\s*\{/.test(original)) {
    return original.replace(
      /export const siteConfig:\s*SiteConfig\s*=\s*\{[\s\S]*\};?\s*$/,
      `export const siteConfig: SiteConfig = ${json};\n`
    );
  }
  return original.replace(
    /export const siteConfig\s*=\s*\{[\s\S]*\};?\s*$/,
    `export const siteConfig = ${json};\n`
  );
}

export { SITE_CONFIG_REL };

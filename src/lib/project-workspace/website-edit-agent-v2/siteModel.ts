import { extractSiteConfigObjectLiteral, parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { ParsedSiteConfig } from '@/lib/site-manager/siteConfigParser';
import type { WebsiteEditAgentOptions } from '../website-edit-agent/types';
import { GLOBALS_CSS, PAGE_TSX, SITE_CONFIG, readWorkspaceRel } from '../website-edit-agent/strategyContext';

export interface SiteModelHero {
  headline?: string;
  subheadline?: string;
  tagline?: string;
}

export interface SiteModelContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface SiteModelSection {
  index: number;
  type?: string;
  title?: string;
  body?: string;
  itemCount: number;
  items: Array<{ title?: string; description?: string; imageUrl?: string }>;
}

export interface SiteModelFileSnapshot {
  path: string;
  content: string;
}

export interface SiteModel {
  mode: WebsiteEditAgentOptions['mode'];
  businessName?: string;
  hero: SiteModelHero;
  contact: SiteModelContact;
  sections: SiteModelSection[];
  files: SiteModelFileSnapshot[];
  capabilities: {
    hasSiteConfig: boolean;
    hasPage: boolean;
    hasGlobalsCss: boolean;
    supportsConfigSkills: boolean;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseRawSiteConfig(content: string): Record<string, unknown> {
  const literal = extractSiteConfigObjectLiteral(content);
  if (!literal) return {};

  try {
    return asRecord(new Function(`return (${literal})`)());
  } catch {
    return {};
  }
}

function buildSections(config: ParsedSiteConfig | null): SiteModelSection[] {
  return (config?.sections ?? []).map((section, index) => {
    const items = Array.isArray(section.items) ? section.items : [];
    return {
      index,
      type: section.type,
      title: section.title,
      body: section.body,
      itemCount: items.length,
      items,
    };
  });
}

function snapshotFile(path: string, content: string | null): SiteModelFileSnapshot | null {
  return content === null ? null : { path, content };
}

/**
 * Build a compact, non-secret model of the editable website workspace.
 */
export async function buildSiteModel(options: WebsiteEditAgentOptions): Promise<SiteModel> {
  const [siteConfigContent, pageContent, globalsContent] = await Promise.all([
    readWorkspaceRel(options, SITE_CONFIG),
    readWorkspaceRel(options, PAGE_TSX),
    readWorkspaceRel(options, GLOBALS_CSS),
  ]);

  const parsed = siteConfigContent ? parseSiteConfigSource(siteConfigContent) : null;
  const raw = siteConfigContent ? parseRawSiteConfig(siteConfigContent) : {};
  const rawHero = asRecord(raw.hero);
  const rawContact = asRecord(raw.contact);
  const contact = parsed?.contact ?? {};

  const files = [
    snapshotFile(SITE_CONFIG, siteConfigContent),
    snapshotFile(PAGE_TSX, pageContent),
    snapshotFile(GLOBALS_CSS, globalsContent),
  ].filter((file): file is SiteModelFileSnapshot => file !== null);

  return {
    mode: options.mode,
    businessName: parsed?.businessName ?? asString(raw.businessName),
    hero: {
      headline: asString(rawHero.headline),
      subheadline: asString(rawHero.subheadline),
      tagline: asString(rawHero.tagline),
    },
    contact: {
      phone: contact.phone ?? asString(rawContact.phone),
      email: contact.email ?? asString(rawContact.email),
      address: contact.address ?? asString(rawContact.address),
    },
    sections: buildSections(parsed),
    files,
    capabilities: {
      hasSiteConfig: siteConfigContent !== null,
      hasPage: pageContent !== null,
      hasGlobalsCss: globalsContent !== null,
      supportsConfigSkills: options.mode === 'gitlab' && siteConfigContent !== null,
    },
  };
}

/**
 * Format the site model for an LLM prompt without including full source files.
 */
export function summarizeSiteModel(model: SiteModel): string {
  const sections = model.sections
    .map((section) => {
      const title = section.title ? ` "${section.title}"` : '';
      return `- [${section.index}] ${section.type ?? 'unknown'}${title} (${section.itemCount} items)`;
    })
    .join('\n');

  return [
    `Mode: ${model.mode}`,
    `Business: ${model.businessName ?? 'unknown'}`,
    `Hero headline: ${model.hero.headline ?? 'unset'}`,
    `Hero subheadline: ${model.hero.subheadline ?? 'unset'}`,
    `Contact phone: ${model.contact.phone ?? 'unset'}`,
    `Contact email: ${model.contact.email ?? 'unset'}`,
    `Contact address: ${model.contact.address ?? 'unset'}`,
    `Config skills available: ${model.capabilities.supportsConfigSkills ? 'yes' : 'no'}`,
    'Sections:',
    sections || '- none',
  ].join('\n');
}


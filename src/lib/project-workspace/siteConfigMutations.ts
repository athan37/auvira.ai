import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  colorNameToBackgroundClass,
  type SiteSectionPresentation,
} from '@/lib/builder/sectionPresentation';
import {
  createActionItem,
  defaultCtaForActionType,
  type ActionModuleKind,
  type ActionType,
} from '@/lib/builder/actionItemTypes';

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
 * Update siteConfig businessName.
 */
export function updateBusinessNameInSource(content: string, value: string): string | null {
  if (!value.trim()) return null;

  return mutateSiteConfigSource(content, (config) => {
    if (config.businessName === value) return false;
    config.businessName = value;
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
 * Append a new row to contact.extraLines (hero/contact card list).
 */
export function appendContactExtraLineInSource(content: string, value: string): string | null {
  const line = value.trim();
  if (!line) return null;

  return mutateSiteConfigSource(content, (config) => {
    const contact = asMutableRecord(config.contact);
    const extraLines = Array.isArray(contact.extraLines)
      ? [...(contact.extraLines as string[])]
      : [];
    const exists = extraLines.some(
      (entry) => String(entry ?? '').trim().toLowerCase() === line.toLowerCase()
    );
    if (exists) return false;
    extraLines.push(line);
    contact.extraLines = extraLines;
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

import { normalizeTailwindBackgroundClass } from '@/lib/builder/tailwindBackgroundResolver';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';

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
      let normalized =
        typeof value === 'string' && value.trim() ? value.trim() : undefined;
      if (key === 'backgroundClass' && normalized) {
        normalized = normalizeTailwindBackgroundClass(normalized);
      }
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
  colorName: string,
  ownerMessage?: string
): string | null {
  const backgroundClass = colorNameToBackgroundClass(colorName, ownerMessage);
  return updateSectionPresentationInSource(content, sectionIndex, { backgroundClass });
}

function subtitleStyleMarkerToColor(subtitle: string): string | null {
  const trimmed = subtitle.trim();
  if (!trimmed) return null;
  const bgPrefix = trimmed.match(/^bg-([a-z]+)-\d{2,3}$/i);
  if (bgPrefix?.[1]) return bgPrefix[1].toLowerCase();
  const marker = trimmed.match(/^([a-z]+)_bg$/i);
  if (marker?.[1]) return marker[1].toLowerCase();
  return null;
}

/**
 * Update a allowlisted config field path in siteConfig.ts source.
 */
export function updateConfigFieldInSource(
  content: string,
  fieldPath: string,
  value: string
): string | null {
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed || !value.trim()) return null;

  return mutateSiteConfigSource(content, (config) => {
    if (parsed.scope === 'businessName') {
      if (config.businessName === value) return false;
      config.businessName = value;
      return true;
    }
    if (parsed.scope === 'hero') {
      const hero = asMutableRecord(config.hero);
      if (hero[parsed.field] === value) return false;
      hero[parsed.field] = value;
      config.hero = hero;
      return true;
    }
    if (parsed.scope === 'contact') {
      const contact = asMutableRecord(config.contact);
      if (parsed.field === 'extraLines' && parsed.contactExtraLineIndex != null) {
        const extraLines = Array.isArray(contact.extraLines)
          ? [...(contact.extraLines as string[])]
          : [];
        const idx = parsed.contactExtraLineIndex;
        if (extraLines[idx] === value) return false;
        while (extraLines.length <= idx) extraLines.push('');
        extraLines[idx] = value;
        contact.extraLines = extraLines;
        config.contact = contact;
        return true;
      }
      if (contact[parsed.field] === value) return false;
      contact[parsed.field] = value;
      config.contact = contact;
      return true;
    }

    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[parsed.sectionIndex ?? -1];
    if (!section) return false;

    if (parsed.scope === 'section') {
      if (section[parsed.field] === value) return false;
      section[parsed.field] = value;
      return true;
    }

    if (parsed.scope === 'actionItem') {
      const actionItems = Array.isArray(section.actionItems)
        ? (section.actionItems as Array<Record<string, unknown>>)
        : [];
      const actionItem = actionItems[parsed.itemIndex ?? -1];
      if (!actionItem) return false;
      if (actionItem[parsed.field] === value) return false;
      actionItem[parsed.field] = value;
      return true;
    }

    const items = Array.isArray(section.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    const item = items[parsed.itemIndex ?? -1];
    if (!item) return false;
    if (item[parsed.field] === value) return false;
    item[parsed.field] = value;
    return true;
  });
}

/**
 * Update section title or body copy in siteConfig.ts source.
 */
export function updateSectionCopyInSource(
  content: string,
  sectionIndex: number,
  field: string,
  value: string
): string | null {
  const allowed = new Set(['title', 'body', 'subtitle']);
  if (!allowed.has(field) || !value.trim() || sectionIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section) return false;
    if (section[field] === value) return false;
    section[field] = value;
    return true;
  });
}

/**
 * Remove a section by index from siteConfig.ts source.
 */
export function removeSectionFromSource(content: string, sectionIndex: number): string | null {
  if (sectionIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    if (sectionIndex >= sections.length) return false;
    sections.splice(sectionIndex, 1);
    config.sections = sections;
    return true;
  });
}

/**
 * Reorder sections in siteConfig.ts source (indices refer to positions before reorder).
 */
export function reorderSectionsInSource(content: string, order: number[]): string | null {
  if (order.length === 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    if (order.length !== sections.length) return false;
    if (order.some((i) => i < 0 || i >= sections.length || !Number.isInteger(i))) return false;
    if (new Set(order).size !== order.length) return false;

    const reordered = order.map((i) => sections[i]!);
    config.sections = reordered;
    return true;
  });
}

/**
 * Migrate legacy subtitle style markers (e.g. "YELLOW_BG") to presentation.backgroundClass.
 */
export function migrateSubtitleStyleMarkersInSource(content: string): string | null {
  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    let changed = false;

    for (const section of sections) {
      const subtitle = normalizeString(section.subtitle);
      if (!subtitle) continue;
      const color = subtitleStyleMarkerToColor(subtitle);
      if (!color) continue;

      const presentation = asMutableRecord(section.presentation);
      const nextBackground = colorNameToBackgroundClass(color);
      if (presentation.backgroundClass !== nextBackground) {
        presentation.backgroundClass = nextBackground;
        section.presentation = presentation;
      }
      delete section.subtitle;
      changed = true;
    }

    return changed;
  });
}

function findActionsSection(
  sections: Array<Record<string, unknown>>,
  moduleKind?: ActionModuleKind
): Record<string, unknown> | undefined {
  return sections.find((section) => {
    const type = normalizeString(section.type)?.toLowerCase();
    if (type !== 'actions') return false;
    if (!moduleKind) return true;
    return normalizeString(section.moduleKind) === moduleKind;
  });
}

/** Ensure an actions section exists; create when missing. */
export function ensureActionsSectionInSource(
  content: string,
  options: {
    moduleKind: ActionModuleKind;
    title: string;
    subtitle?: string;
  }
): string | null {
  const title = normalizeString(options.title);
  if (!title) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const existing = findActionsSection(sections, options.moduleKind);
    if (existing) return false;

    sections.push({
      type: 'actions',
      title,
      subtitle: normalizeString(options.subtitle) ?? undefined,
      body: normalizeString(options.subtitle) ?? undefined,
      moduleKind: options.moduleKind,
      actionItems: [],
    });
    config.sections = sections;
    return true;
  });
}

/** Add an action item to the first matching actions section (or create one). */
export function addActionItemToSource(
  content: string,
  item: {
    name: string;
    description?: string;
    valueLabel?: string;
    actionType: ActionType;
    moduleKind?: ActionModuleKind;
    ctaLabel?: string;
    sectionTitle?: string;
  }
): string | null {
  const name = normalizeString(item.name);
  if (!name) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    let actions = findActionsSection(sections, item.moduleKind);
    if (!actions) {
      actions = {
        type: 'actions',
        title: item.sectionTitle ?? 'Actions',
        moduleKind: item.moduleKind ?? 'service_packages',
        actionItems: [],
      };
      sections.unshift(actions);
      config.sections = sections;
    }

    const actionItems = Array.isArray(actions.actionItems)
      ? (actions.actionItems as Array<Record<string, unknown>>)
      : [];
    const exists = actionItems.some(
      (existing) => normalizeString(existing.name)?.toLowerCase() === name.toLowerCase()
    );
    if (exists) return false;

    const nextItem = createActionItem({
      name,
      description: normalizeString(item.description) ?? undefined,
      valueLabel: normalizeString(item.valueLabel) ?? undefined,
      actionType: item.actionType,
      ctaLabel: normalizeString(item.ctaLabel) ?? defaultCtaForActionType(item.actionType),
    });
    actionItems.push(nextItem as unknown as Record<string, unknown>);
    actions.actionItems = actionItems;
    return true;
  });
}

/** Update fields on an action item by section and item index. */
export function updateActionItemInSource(
  content: string,
  sectionIndex: number,
  itemIndex: number,
  patch: Partial<{ name: string; description: string; valueLabel: string; ctaLabel: string }>
): string | null {
  if (sectionIndex < 0 || itemIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || normalizeString(section.type) !== 'actions') return false;

    const actionItems = Array.isArray(section.actionItems)
      ? (section.actionItems as Array<Record<string, unknown>>)
      : [];
    const item = actionItems[itemIndex];
    if (!item) return false;

    let changed = false;
    for (const [key, raw] of Object.entries(patch)) {
      const value = normalizeString(raw);
      if (!value || item[key] === value) continue;
      item[key] = value;
      changed = true;
    }
    return changed;
  });
}

/** Remove an action item by section and item index. */
export function removeActionItemFromSource(
  content: string,
  sectionIndex: number,
  itemIndex: number
): string | null {
  if (sectionIndex < 0 || itemIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || normalizeString(section.type) !== 'actions') return false;

    const actionItems = Array.isArray(section.actionItems)
      ? (section.actionItems as Array<Record<string, unknown>>)
      : [];
    if (itemIndex >= actionItems.length) return false;
    actionItems.splice(itemIndex, 1);
    section.actionItems = actionItems;
    return true;
  });
}

/** Update action item field via parsed config field path. */
export function updateActionItemFieldInSource(
  content: string,
  sectionIndex: number,
  itemIndex: number,
  field: string,
  value: string
): string | null {
  const allowed = new Set(['name', 'description', 'valueLabel', 'ctaLabel']);
  if (!allowed.has(field) || !value.trim()) return null;
  return updateActionItemInSource(content, sectionIndex, itemIndex, { [field]: value });
}

const SECTION_ITEM_FIELDS = ['title', 'description', 'imageUrl', 'alt', 'label', 'href'] as const;

export type SectionItemField = (typeof SECTION_ITEM_FIELDS)[number];

export type SectionItemRecord = Partial<Record<SectionItemField, string>>;

function isActionsSection(section: Record<string, unknown>): boolean {
  return normalizeString(section.type) === 'actions';
}

function getSectionItemsArray(section: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(section.items)) {
    section.items = [];
  }
  return section.items as Array<Record<string, unknown>>;
}

/** Shallow clone of a section item for duplicate/add-like-this flows. */
export function cloneSectionItemRecord(item: Record<string, unknown>): SectionItemRecord {
  const cloned: SectionItemRecord = {};
  for (const field of SECTION_ITEM_FIELDS) {
    const value = normalizeString(item[field]);
    if (value) cloned[field] = value;
  }
  return cloned;
}

function applySectionItemPatch(
  item: Record<string, unknown>,
  patch: SectionItemRecord
): boolean {
  let changed = false;
  for (const [key, raw] of Object.entries(patch)) {
    if (!(SECTION_ITEM_FIELDS as readonly string[]).includes(key)) continue;
    const value = normalizeString(raw);
    if (!value) continue;
    if (item[key] !== value) {
      item[key] = value;
      changed = true;
    }
  }
  return changed;
}

function buildSectionItemRecord(
  item: SectionItemRecord,
  fallbackTitle = 'New item'
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  const title = normalizeString(item.title) ?? fallbackTitle;
  next.title = title;
  for (const field of SECTION_ITEM_FIELDS) {
    if (field === 'title') continue;
    const value = normalizeString(item[field]);
    if (value) next[field] = value;
  }
  return next;
}

/**
 * Add an item to sections[sectionIndex].items (append or insert after index).
 */
export function addSectionItemToSource(
  content: string,
  sectionIndex: number,
  item: SectionItemRecord,
  options?: { insertAfterIndex?: number; fallbackTitle?: string }
): string | null {
  if (sectionIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || isActionsSection(section)) return false;

    const items = getSectionItemsArray(section);
    const nextItem = buildSectionItemRecord(item, options?.fallbackTitle ?? 'New item');
    const insertAfterIndex = options?.insertAfterIndex;
    if (insertAfterIndex != null && insertAfterIndex >= 0 && insertAfterIndex < items.length) {
      items.splice(insertAfterIndex + 1, 0, nextItem);
    } else {
      items.push(nextItem);
    }
    section.items = items;
    return true;
  });
}

/** Remove an item from sections[sectionIndex].items by index. */
export function removeSectionItemFromSource(
  content: string,
  sectionIndex: number,
  itemIndex: number
): string | null {
  if (sectionIndex < 0 || itemIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || isActionsSection(section)) return false;

    const items = Array.isArray(section.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    if (itemIndex >= items.length) return false;
    items.splice(itemIndex, 1);
    section.items = items;
    return true;
  });
}

/** Duplicate an item in sections[sectionIndex].items, inserting after the source index. */
export function duplicateSectionItemInSource(
  content: string,
  sectionIndex: number,
  itemIndex: number,
  overrides?: SectionItemRecord
): string | null {
  if (sectionIndex < 0 || itemIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || isActionsSection(section)) return false;

    const items = Array.isArray(section.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    const source = items[itemIndex];
    if (!source) return false;

    const cloned = buildSectionItemRecord(cloneSectionItemRecord(source));
    if (overrides) applySectionItemPatch(cloned, overrides);
    items.splice(itemIndex + 1, 0, cloned);
    section.items = items;
    return true;
  });
}

/** Patch allowlisted fields on sections[sectionIndex].items[itemIndex]. */
export function updateSectionItemInSource(
  content: string,
  sectionIndex: number,
  itemIndex: number,
  patch: SectionItemRecord
): string | null {
  if (sectionIndex < 0 || itemIndex < 0) return null;

  return mutateSiteConfigSource(content, (config) => {
    const sections = Array.isArray(config.sections)
      ? (config.sections as Array<Record<string, unknown>>)
      : [];
    const section = sections[sectionIndex];
    if (!section || isActionsSection(section)) return false;

    const items = Array.isArray(section.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    const item = items[itemIndex];
    if (!item) return false;

    return applySectionItemPatch(item, patch);
  });
}


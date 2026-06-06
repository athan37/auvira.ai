import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { ParsedConfigFieldPath } from './configFieldPaths';
import {
  contactExtraLineFieldPath,
  heroFieldPath,
  actionItemFieldPath,
  parseConfigFieldPath,
  sectionFieldPath,
  sectionItemFieldPath,
} from './configFieldPaths';

export interface AllowlistedFieldEntry {
  fieldPath: string;
  value: string;
  scope: ParsedConfigFieldPath['scope'];
  field: string;
  sectionIndex?: number;
  sectionType?: string;
  sectionTitle?: string;
  itemIndex?: number;
  labels: string[];
}

function pushEntry(
  entries: AllowlistedFieldEntry[],
  fieldPath: string,
  value: unknown,
  meta: Omit<AllowlistedFieldEntry, 'fieldPath' | 'value' | 'labels'> & { labels?: string[] },
  options?: { allowEmpty?: boolean }
): void {
  const text = String(value ?? '').trim();
  if (!text && !options?.allowEmpty) return;
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed) return;
  if (entries.some((e) => e.fieldPath === fieldPath)) return;

  const labels = meta.labels ?? [meta.field, fieldPath];
  if (meta.sectionTitle) labels.push(meta.sectionTitle);
  if (meta.sectionType) labels.push(meta.sectionType);

  entries.push({
    fieldPath,
    value: text,
    scope: parsed.scope,
    field: parsed.field,
    sectionIndex: meta.sectionIndex,
    sectionType: meta.sectionType,
    sectionTitle: meta.sectionTitle,
    itemIndex: meta.itemIndex,
    labels: [...new Set(labels.map((l) => l.toLowerCase()))],
  });
}

/**
 * Enumerate all allowlisted string fields in parsed siteConfig for copy resolution.
 */
export function enumerateAllowlistedFields(
  siteConfigContent: string
): AllowlistedFieldEntry[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed) return [];

  const entries: AllowlistedFieldEntry[] = [];

  if (parsed.businessName?.trim()) {
    pushEntry(entries, 'businessName', parsed.businessName, {
      scope: 'businessName',
      field: 'businessName',
      labels: ['business', 'business name', 'company name'],
    });
  }

  for (const field of ['headline', 'subheadline', 'tagline', 'primaryCta', 'secondaryCta'] as const) {
    const raw = parsed.hero?.[field];
    pushEntry(entries, heroFieldPath(field), raw ?? '', {
      scope: 'hero',
      field,
      labels: [
        field,
        field === 'headline' ? 'title' : field,
        ...(field === 'primaryCta'
          ? ['primary button', 'primary cta', 'cta button', 'get in touch btn', 'call to action']
          : []),
        ...(field === 'secondaryCta' ? ['secondary button', 'secondary cta'] : []),
      ],
    }, { allowEmpty: true });
  }

  const contact = parsed.contact;
  for (const field of ['phone', 'email', 'address'] as const) {
    pushEntry(entries, `contact.${field}`, contact?.[field], {
      scope: 'contact',
      field,
      labels: [field, 'contact', `contact ${field}`],
    });
  }

  const extraLines = Array.isArray(contact?.extraLines) ? (contact!.extraLines as unknown[]) : [];
  extraLines.forEach((line, index) => {
    pushEntry(entries, contactExtraLineFieldPath(index), line, {
      scope: 'contact',
      field: 'extraLines',
      labels: ['contact line', `contact line ${index + 1}`, 'extra line', 'contact card line'],
    });
  });

  const sections = parsed.sections;

  sections.forEach((section, sectionIndex) => {
    const sectionType = String(section.type ?? '');
    const sectionTitle = String(section.title ?? '').trim();

    for (const field of ['title', 'subtitle', 'body'] as const) {
    pushEntry(entries, sectionFieldPath(sectionIndex, field), section[field], {
      scope: 'section',
      field,
      sectionIndex,
      sectionType,
      sectionTitle,
      labels: [
        field,
        `section ${field}`,
        sectionTitle,
        sectionType,
        ...(sectionType === 'contact' && field === 'subtitle'
          ? ['contact information', 'contact info', 'information', 'card title', 'panel title']
          : []),
      ],
    }, sectionType === 'contact' && field === 'subtitle' ? { allowEmpty: true } : undefined);
    }

    const items = Array.isArray(section.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    items.forEach((item, itemIndex) => {
      for (const field of ['title', 'description', 'label', 'imageUrl', 'alt', 'href'] as const) {
        pushEntry(
          entries,
          sectionItemFieldPath(sectionIndex, itemIndex, field),
          item[field],
          {
            scope: 'sectionItem',
            field,
            sectionIndex,
            sectionType,
            sectionTitle,
            itemIndex,
            labels: [field, `item ${field}`, sectionTitle],
          }
        );
      }
    });

    const actionItems = Array.isArray(section.actionItems)
      ? (section.actionItems as Array<Record<string, unknown>>)
      : [];
    actionItems.forEach((item, itemIndex) => {
      for (const field of ['name', 'description', 'valueLabel', 'ctaLabel'] as const) {
        pushEntry(
          entries,
          actionItemFieldPath(sectionIndex, itemIndex, field),
          item[field],
          {
            scope: 'actionItem',
            field,
            sectionIndex,
            sectionType,
            sectionTitle,
            itemIndex,
            labels: [field, `action ${field}`, sectionTitle, 'price', 'cta', 'button'],
          }
        );
      }
    });
  });

  return entries;
}

/** Filter index entries to a pinned section (and its items). */
export function filterFieldsToSection(
  entries: AllowlistedFieldEntry[],
  sectionIndex: number
): AllowlistedFieldEntry[] {
  return entries.filter((e) => e.sectionIndex === sectionIndex);
}

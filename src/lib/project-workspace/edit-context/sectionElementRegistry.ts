import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { contactExtraLineFieldPath, heroFieldPath, sectionFieldPath, sectionItemFieldPath } from './configFieldPaths';
import {
  enumerateAllowlistedFields,
  filterFieldsToSection,
  type AllowlistedFieldEntry,
} from './enumerateAllowlistedFields';
import type {
  SectionSurface,
  SectionSurfaceConfidence,
  SectionSurfaceEditFamily,
  SectionSurfaceSource,
} from './sectionSurfaceCatalog';

export type SectionElementKind =
  | 'heading'
  | 'body'
  | 'button'
  | 'contact_field'
  | 'item_title'
  | 'item_body'
  | 'action_item'
  | 'action_title'
  | 'action_value'
  | 'action_cta'
  | 'panel'
  | 'image_caption';

export type SectionElementSource = SectionSurfaceSource | 'embedded_global';

/** One editable element surface inside a pinned section (config path + match metadata). */
export interface SectionElementSurface extends SectionSurface {
  elementKind?: SectionElementKind;
  matchAliases?: string[];
  placement?: string;
  itemIndex?: number;
}

const CONTACT_SUBTITLE_FALLBACK = 'Contact Information';

const PRESENTATION_STYLE_SURFACES: Array<{
  field: 'backgroundClass' | 'cardClass';
  humanLabel: string;
}> = [
  { field: 'backgroundClass', humanLabel: 'Section background' },
  { field: 'cardClass', humanLabel: 'Inner card background' },
];

const ITEM_SECTION_TYPES = new Set([
  'services',
  'about',
  'features',
  'faq',
  'testimonials',
  'generic',
]);

function surfaceIdFor(fieldPath: string): string {
  return fieldPath.replace(/[\[\].]/g, '_');
}

function entryToSurface(
  entry: AllowlistedFieldEntry,
  opts: {
    elementKind?: SectionElementKind;
    humanLabel?: string;
    matchAliases?: string[];
    source?: SectionElementSource;
    fallbackText?: string;
    placement?: string;
    itemIndex?: number;
  } = {}
): SectionElementSurface {
  const visible = entry.value.trim() || opts.fallbackText;
  const source: SectionElementSource =
    opts.source ??
    (entry.value.trim() ? 'config' : opts.fallbackText ? 'renderer_fallback' : 'config');
  return {
    surfaceId: surfaceIdFor(entry.fieldPath),
    humanLabel: opts.humanLabel ?? entry.field,
    fieldPath: entry.fieldPath,
    visibleText: visible || undefined,
    source,
    editFamily: 'copy',
    confidence: (entry.value.trim() ? 'high' : 'medium') as SectionSurfaceConfidence,
    elementKind: opts.elementKind,
    matchAliases: opts.matchAliases,
    placement: opts.placement,
    itemIndex: opts.itemIndex ?? entry.itemIndex,
  };
}

function buildHeroElementSurfaces(
  parsed: NonNullable<ReturnType<typeof parseSiteConfigSource>>
): SectionElementSurface[] {
  const hero = parsed.hero ?? {};
  const surfaces: SectionElementSurface[] = [];

  const fields: Array<{
    field: 'headline' | 'subheadline' | 'primaryCta' | 'secondaryCta';
    elementKind: SectionElementKind;
    humanLabel: string;
    matchAliases: string[];
  }> = [
    { field: 'headline', elementKind: 'heading', humanLabel: 'Hero headline', matchAliases: ['headline', 'hero title'] },
    {
      field: 'subheadline',
      elementKind: 'body',
      humanLabel: 'Hero subheadline',
      matchAliases: ['subheadline', 'tagline'],
    },
    {
      field: 'primaryCta',
      elementKind: 'button',
      humanLabel: 'Primary button',
      matchAliases: ['get in touch btn', 'get in touch button', 'primary button', 'primary cta', 'cta button'],
    },
    {
      field: 'secondaryCta',
      elementKind: 'button',
      humanLabel: 'Secondary button',
      matchAliases: ['secondary button', 'secondary cta'],
    },
  ];

  for (const { field, elementKind, humanLabel, matchAliases } of fields) {
    const value = String(hero[field] ?? '').trim();
    surfaces.push({
      surfaceId: surfaceIdFor(heroFieldPath(field)),
      humanLabel,
      fieldPath: heroFieldPath(field),
      visibleText: value || undefined,
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: value ? 'high' : 'medium',
      elementKind,
      matchAliases,
    });
  }

  return surfaces;
}

function contactEmbeddedSurfaces(
  parsed: NonNullable<ReturnType<typeof parseSiteConfigSource>>,
  sectionIndex: number
): SectionElementSurface[] {
  const surfaces: SectionElementSurface[] = [];
  const hero = parsed.hero ?? {};
  const contact = parsed.contact ?? {};

  const primaryCta = String(hero.primaryCta ?? '').trim();
  if (primaryCta) {
    surfaces.push({
      surfaceId: 'hero_primaryCta',
      elementKind: 'button',
      humanLabel: 'Primary button (also used in hero/nav)',
      fieldPath: heroFieldPath('primaryCta'),
      visibleText: primaryCta,
      matchAliases: [
        'get in touch btn',
        'get in touch button',
        'primary button',
        'primary cta',
        'cta button',
        'call to action',
      ],
      placement: 'left_column',
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: 'high',
    });
  }

  const phone = String(contact.phone ?? '').trim();
  if (phone) {
    surfaces.push({
      surfaceId: `contact_phone_button_${sectionIndex}`,
      elementKind: 'button',
      humanLabel: 'Phone button',
      fieldPath: 'contact.phone',
      visibleText: phone,
      matchAliases: ['phone button', 'call button', 'phone link', 'call link'],
      placement: 'left_column',
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: 'high',
    });
    surfaces.push({
      surfaceId: `contact_phone_card_${sectionIndex}`,
      elementKind: 'contact_field',
      humanLabel: 'Phone number in card',
      fieldPath: 'contact.phone',
      visibleText: phone,
      matchAliases: ['phone in card', 'phone number in card', 'inner phone', 'card phone'],
      placement: 'inner_card',
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: 'high',
    });
  }

  const email = String(contact.email ?? '').trim();
  if (email) {
    surfaces.push({
      surfaceId: `contact_email_card_${sectionIndex}`,
      elementKind: 'contact_field',
      humanLabel: 'Email in card',
      fieldPath: 'contact.email',
      visibleText: email,
      matchAliases: ['email in card', 'inner email', 'card email'],
      placement: 'inner_card',
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: 'high',
    });
  }

  const extraLines = Array.isArray(contact.extraLines) ? (contact.extraLines as string[]) : [];
  extraLines.forEach((line, index) => {
    const value = String(line ?? '').trim();
    if (!value) return;
    surfaces.push({
      surfaceId: `contact_extra_line_${sectionIndex}_${index}`,
      elementKind: 'contact_field',
      humanLabel: `Contact line ${index + 1} in card`,
      fieldPath: contactExtraLineFieldPath(index),
      visibleText: value,
      matchAliases: ['contact line', 'extra line', 'contact card line', `line ${index + 1}`],
      placement: 'inner_card',
      source: 'embedded_global',
      editFamily: 'copy',
      confidence: 'high',
    });
  });

  return surfaces;
}

function itemSurfaces(
  sectionIndex: number,
  sectionType: string,
  items: Array<Record<string, unknown>>
): SectionElementSurface[] {
  const surfaces: SectionElementSurface[] = [];
  const isGallery = sectionType === 'gallery';

  items.forEach((item, itemIndex) => {
    const title = String(item.title ?? '').trim();
    const description = String(item.description ?? '').trim();

    if (title) {
      surfaces.push({
        surfaceId: surfaceIdFor(sectionItemFieldPath(sectionIndex, itemIndex, 'title')),
        elementKind: isGallery ? 'image_caption' : 'item_title',
        humanLabel: isGallery
          ? `Gallery image ${itemIndex + 1} caption`
          : `${sectionType} card ${itemIndex + 1} title`,
        fieldPath: sectionItemFieldPath(sectionIndex, itemIndex, 'title'),
        visibleText: title,
        matchAliases: [
          `item ${itemIndex + 1}`,
          `card ${itemIndex + 1}`,
          `${ordinalLabel(itemIndex)} card`,
          `${ordinalLabel(itemIndex)} service`,
          `${ordinalLabel(itemIndex)} item`,
        ],
        itemIndex,
        source: 'config',
        editFamily: 'copy',
        confidence: 'high',
      });
    }

    if (description) {
      surfaces.push({
        surfaceId: surfaceIdFor(sectionItemFieldPath(sectionIndex, itemIndex, 'description')),
        elementKind: isGallery ? 'image_caption' : 'item_body',
        humanLabel: isGallery
          ? `Gallery image ${itemIndex + 1} caption`
          : `${sectionType} card ${itemIndex + 1} description`,
        fieldPath: sectionItemFieldPath(sectionIndex, itemIndex, 'description'),
        visibleText: description,
        matchAliases: [
          `item ${itemIndex + 1} description`,
          `card ${itemIndex + 1} body`,
          `${ordinalLabel(itemIndex)} description`,
        ],
        itemIndex,
        source: 'config',
        editFamily: 'copy',
        confidence: 'high',
      });
    }
  });

  return surfaces;
}

function ordinalLabel(index: number): string {
  const labels = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  return labels[index] ?? `item ${index + 1}`;
}

function presentationSurfaces(sectionIndex: number): SectionElementSurface[] {
  return PRESENTATION_STYLE_SURFACES.map(({ field, humanLabel }) => ({
    surfaceId: surfaceIdFor(`sections[${sectionIndex}].presentation.${field}`),
    humanLabel,
    fieldPath: `sections[${sectionIndex}].presentation.${field}`,
    source: 'presentation' as SectionSurfaceSource,
    editFamily: 'style' as SectionSurfaceEditFamily,
    confidence: 'high' as SectionSurfaceConfidence,
    elementKind: 'panel' as SectionElementKind,
    matchAliases: [humanLabel.toLowerCase(), field],
  }));
}

function humanLabelForSectionField(
  entry: AllowlistedFieldEntry,
  sectionType: string
): string {
  if (sectionType === 'contact' && entry.field === 'subtitle') {
    return 'Inner card heading';
  }
  if (entry.field === 'title') return 'Section title';
  if (entry.field === 'body') return 'Section intro text';
  if (entry.field === 'subtitle') return 'Section subtitle';
  return entry.field;
}

/**
 * Build render-aware element catalog for a pinned section (all section types).
 */
export function buildSectionElementCatalog(
  siteConfigContent: string,
  sectionIndex: number,
  options?: { selectedTarget?: SelectedTargetInput }
): SectionElementSurface[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const section = parsed?.sections?.[sectionIndex];
  const sectionType = String(section?.type ?? options?.selectedTarget?.sectionType ?? '');
  const pinKind = options?.selectedTarget?.kind;

  if (pinKind === 'hero' || sectionType === 'hero') {
    const surfaces = parsed ? buildHeroElementSurfaces(parsed) : [];
    const pinPath = options?.selectedTarget?.fieldPath?.trim();
    if (pinPath) {
      const pinned = surfaces.find((s) => s.fieldPath === pinPath);
      if (pinned) {
        return [pinned, ...surfaces.filter((s) => s.fieldPath !== pinPath)];
      }
    }
    return surfaces;
  }

  const allEntries = enumerateAllowlistedFields(siteConfigContent);
  const sectionEntries = filterFieldsToSection(allEntries, sectionIndex);
  const byPath = new Map<string, SectionElementSurface>();

  for (const entry of sectionEntries.filter(
    (e) => e.scope === 'section' && ['title', 'subtitle', 'body'].includes(e.field)
  )) {
    const fallback =
      sectionType === 'contact' && entry.field === 'subtitle' && !entry.value.trim()
        ? CONTACT_SUBTITLE_FALLBACK
        : undefined;
    byPath.set(
      entry.fieldPath,
      entryToSurface(entry, {
        elementKind: entry.field === 'body' ? 'body' : 'heading',
        humanLabel: humanLabelForSectionField(entry, sectionType),
        matchAliases: entry.labels,
        fallbackText: fallback,
      })
    );
  }

  for (const entry of sectionEntries.filter((e) => e.scope === 'sectionItem')) {
    const kind =
      entry.field === 'title'
        ? sectionType === 'gallery'
          ? 'image_caption'
          : 'item_title'
        : entry.field === 'description'
          ? sectionType === 'gallery'
            ? 'image_caption'
            : 'item_body'
          : undefined;
    byPath.set(
      entry.fieldPath,
      entryToSurface(entry, {
        elementKind: kind,
        humanLabel:
          entry.field === 'title'
            ? `${sectionType} item ${(entry.itemIndex ?? 0) + 1} title`
            : `${sectionType} item ${(entry.itemIndex ?? 0) + 1} description`,
        matchAliases: entry.labels,
      })
    );
  }

  for (const entry of sectionEntries.filter((e) => e.scope === 'actionItem')) {
    const kind =
      entry.field === 'name'
        ? 'action_title'
        : entry.field === 'valueLabel'
          ? 'action_value'
          : entry.field === 'ctaLabel'
            ? 'action_cta'
            : 'action_item';
    byPath.set(
      entry.fieldPath,
      entryToSurface(entry, {
        elementKind: kind,
        humanLabel:
          entry.field === 'name'
            ? `Action card ${(entry.itemIndex ?? 0) + 1} title`
            : entry.field === 'valueLabel'
              ? `Action card ${(entry.itemIndex ?? 0) + 1} price`
              : entry.field === 'ctaLabel'
                ? `Action card ${(entry.itemIndex ?? 0) + 1} button`
                : `Action card ${(entry.itemIndex ?? 0) + 1}`,
        matchAliases: entry.labels,
      })
    );
  }

  if (sectionType === 'contact' && parsed) {
    for (const embedded of contactEmbeddedSurfaces(parsed, sectionIndex)) {
      byPath.set(embedded.surfaceId, embedded);
    }
  }

  if (ITEM_SECTION_TYPES.has(sectionType) || sectionType === 'gallery') {
    const items = Array.isArray(section?.items)
      ? (section.items as Array<Record<string, unknown>>)
      : [];
    for (const itemSurface of itemSurfaces(sectionIndex, sectionType, items)) {
      const existing = byPath.get(itemSurface.fieldPath);
      if (existing) {
        byPath.set(itemSurface.fieldPath, {
          ...existing,
          ...itemSurface,
          humanLabel: itemSurface.humanLabel,
          elementKind: itemSurface.elementKind,
          matchAliases: [
            ...new Set([...(existing.matchAliases ?? []), ...(itemSurface.matchAliases ?? [])]),
          ],
        });
      } else {
        byPath.set(itemSurface.fieldPath, itemSurface);
      }
    }
  }

  if (!byPath.has(sectionFieldPath(sectionIndex, 'subtitle')) && sectionType === 'contact') {
    byPath.set(
      sectionFieldPath(sectionIndex, 'subtitle'),
      {
        surfaceId: surfaceIdFor(sectionFieldPath(sectionIndex, 'subtitle')),
        elementKind: 'heading',
        humanLabel: 'Inner card heading',
        fieldPath: sectionFieldPath(sectionIndex, 'subtitle'),
        visibleText: CONTACT_SUBTITLE_FALLBACK,
        source: 'renderer_fallback',
        editFamily: 'copy',
        confidence: 'medium',
        matchAliases: ['contact information', 'contact info', 'inner card heading', 'card title'],
      }
    );
  }

  for (const style of presentationSurfaces(sectionIndex)) {
    if (!byPath.has(style.fieldPath)) byPath.set(style.fieldPath, style);
  }

  const surfaces = [...byPath.values()];

  const pinPath = options?.selectedTarget?.fieldPath?.trim();
  if (pinPath) {
    const pinned = surfaces.find((s) => s.fieldPath === pinPath);
    if (pinned) {
      return [pinned, ...surfaces.filter((s) => s.fieldPath !== pinPath)];
    }
  }

  return surfaces;
}

/** Restrict element catalog to a single pinned surface (fieldPath + optional surfaceId). */
export function filterCatalogToPin(
  catalog: SectionElementSurface[],
  pin: { fieldPath?: string; surfaceId?: string }
): SectionElementSurface[] {
  const fieldPath = pin.fieldPath?.trim();
  if (!fieldPath) return catalog;

  const surfaceId = pin.surfaceId?.trim();
  if (surfaceId) {
    const bySurface = catalog.filter((surface) => surface.surfaceId === surfaceId);
    if (bySurface.length > 0) return bySurface;
  }

  const byPath = catalog.filter((surface) => surface.fieldPath === fieldPath);
  return byPath.length > 0 ? byPath : catalog.slice(0, 1);
}

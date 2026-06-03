import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { sectionFieldPath } from './configFieldPaths';
import {
  enumerateAllowlistedFields,
  filterFieldsToSection,
  type AllowlistedFieldEntry,
} from './enumerateAllowlistedFields';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

export type SectionSurfaceSource = 'config' | 'renderer_fallback' | 'presentation';
export type SectionSurfaceEditFamily = 'copy' | 'style';
export type SectionSurfaceConfidence = 'high' | 'medium' | 'low';

/** One editable surface inside a pinned section (config path + human label). */
export interface SectionSurface {
  surfaceId: string;
  humanLabel: string;
  fieldPath: string;
  visibleText?: string;
  source: SectionSurfaceSource;
  editFamily: SectionSurfaceEditFamily;
  confidence: SectionSurfaceConfidence;
}

const PRESENTATION_STYLE_SURFACES: Array<{
  field: 'backgroundClass' | 'cardClass';
  humanLabel: string;
}> = [
  { field: 'backgroundClass', humanLabel: 'Section background' },
  { field: 'cardClass', humanLabel: 'Inner card background' },
];

const CONTACT_SUBTITLE_FALLBACK = 'Contact Information';

function surfaceIdFor(fieldPath: string): string {
  return fieldPath.replace(/[\[\].]/g, '_');
}

function entryToCopySurface(entry: AllowlistedFieldEntry, fallbackText?: string): SectionSurface {
  const visible = entry.value.trim() || fallbackText;
  const source: SectionSurfaceSource =
    entry.value.trim() ? 'config' : fallbackText ? 'renderer_fallback' : 'config';
  return {
    surfaceId: surfaceIdFor(entry.fieldPath),
    humanLabel: humanLabelForField(entry),
    fieldPath: entry.fieldPath,
    visibleText: visible || undefined,
    source,
    editFamily: 'copy',
    confidence: entry.value.trim() ? 'high' : 'medium',
  };
}

function humanLabelForField(entry: AllowlistedFieldEntry): string {
  if (entry.sectionType === 'contact' && entry.field === 'subtitle') {
    return 'Inner card heading';
  }
  if (entry.field === 'title') return 'Section title';
  if (entry.field === 'body') return 'Section intro text';
  if (entry.field === 'subtitle') return 'Section subtitle';
  return `${entry.field} (${entry.fieldPath})`;
}

function templateFallbackSurfaces(
  sectionIndex: number,
  sectionType: string,
  sectionTitle: string
): SectionSurface[] {
  const surfaces: SectionSurface[] = [];
  if (sectionType === 'contact') {
    surfaces.push({
      surfaceId: surfaceIdFor(sectionFieldPath(sectionIndex, 'subtitle')),
      humanLabel: 'Inner card heading',
      fieldPath: sectionFieldPath(sectionIndex, 'subtitle'),
      visibleText: CONTACT_SUBTITLE_FALLBACK,
      source: 'renderer_fallback',
      editFamily: 'copy',
      confidence: 'medium',
    });
  }
  if (sectionTitle) {
    surfaces.push({
      surfaceId: surfaceIdFor(sectionFieldPath(sectionIndex, 'title')),
      humanLabel: 'Section title',
      fieldPath: sectionFieldPath(sectionIndex, 'title'),
      visibleText: sectionTitle,
      source: 'renderer_fallback',
      editFamily: 'copy',
      confidence: 'low',
    });
  }
  return surfaces;
}

function presentationSurfaces(sectionIndex: number): SectionSurface[] {
  return PRESENTATION_STYLE_SURFACES.map(({ field, humanLabel }) => ({
    surfaceId: surfaceIdFor(`sections[${sectionIndex}].presentation.${field}`),
    humanLabel,
    fieldPath: `sections[${sectionIndex}].presentation.${field}`,
    source: 'presentation' as const,
    editFamily: 'style' as const,
    confidence: 'high' as const,
  }));
}

/**
 * Build render-aware surface catalog for a pinned section index.
 */
export function buildSectionSurfaceCatalog(
  siteConfigContent: string,
  sectionIndex: number,
  options?: { selectedTarget?: SelectedTargetInput }
): SectionSurface[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const section = parsed?.sections?.[sectionIndex];
  const sectionType = String(section?.type ?? options?.selectedTarget?.sectionType ?? '');
  const sectionTitle = String(
    section?.title ?? options?.selectedTarget?.sectionTitle ?? ''
  ).trim();

  const allEntries = enumerateAllowlistedFields(siteConfigContent);
  const sectionEntries = filterFieldsToSection(allEntries, sectionIndex).filter(
    (e) => e.scope === 'section' && ['title', 'subtitle', 'body'].includes(e.field)
  );

  const byPath = new Map<string, SectionSurface>();

  for (const entry of sectionEntries) {
    const fallback =
      sectionType === 'contact' && entry.field === 'subtitle' && !entry.value.trim()
        ? CONTACT_SUBTITLE_FALLBACK
        : undefined;
    byPath.set(entry.fieldPath, entryToCopySurface(entry, fallback));
  }

  for (const fb of templateFallbackSurfaces(sectionIndex, sectionType, sectionTitle)) {
    if (!byPath.has(fb.fieldPath)) byPath.set(fb.fieldPath, fb);
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

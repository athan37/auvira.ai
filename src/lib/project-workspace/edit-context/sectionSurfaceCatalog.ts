import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { buildSectionElementCatalog } from './sectionElementRegistry';

export type SectionSurfaceSource = 'config' | 'renderer_fallback' | 'presentation' | 'embedded_global';
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

/**
 * Build render-aware surface catalog for a pinned section index.
 * Delegates to the section element registry (all section types).
 */
export function buildSectionSurfaceCatalog(
  siteConfigContent: string,
  sectionIndex: number,
  options?: { selectedTarget?: SelectedTargetInput }
): SectionSurface[] {
  return buildSectionElementCatalog(siteConfigContent, sectionIndex, options);
}

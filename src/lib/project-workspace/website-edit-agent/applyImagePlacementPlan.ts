import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import {
  parseSiteConfigSource,
  rebuildSiteConfigFile,
} from '@/lib/site-manager/siteConfigParser';
import type { GalleryPlacement } from './gallerySiteConfig';
import {
  humanizeImageItemTitle,
  insertGallerySectionInSiteConfig,
  stripExistingGallerySections,
} from './gallerySiteConfig';
import { stripPlaceholderPhotoSections } from './validateGallerySiteConfig';
import type { ImagePlacementPlan } from './imagePlacementPlan';
import { resolveTargetSectionForImages } from './imageSectionIntent';
import {
  pickPreferredInsertAnchor,
  type SiteStructureSnapshot,
} from './siteStructureAnalysis';

function placementFromPlan(
  plan: ImagePlacementPlan,
  snapshot: SiteStructureSnapshot
): GalleryPlacement {
  if (!plan.insertAfterSectionType) {
    return 'prepend';
  }
  const t = plan.insertAfterSectionType.toLowerCase();
  if (snapshot.sections.some((s) => s.type === t)) {
    return `after:${t}` as GalleryPlacement;
  }
  const fallback = pickPreferredInsertAnchor(snapshot);
  return fallback ? (`after:${fallback}` as GalleryPlacement) : 'prepend';
}

function buildItems(attachments: WorkspaceAssetAttachment[], titles?: string[]) {
  return attachments.map((asset, index) => ({
    title: titles?.[index] ?? humanizeImageItemTitle(asset.originalName, index),
    imageUrl: asset.publicUrl,
  }));
}

/**
 * Apply placement plan to siteConfig source (returns full file content).
 */
export function applyImagePlacementToSiteConfig(
  siteConfigSource: string,
  plan: ImagePlacementPlan,
  attachments: WorkspaceAssetAttachment[],
  snapshot: SiteStructureSnapshot,
  ownerMessage = ''
): string {
  const config = parseSiteConfigSource(siteConfigSource);
  if (!config) {
    return siteConfigSource;
  }

  const newItems = buildItems(attachments);
  const galleryTitle = plan.title || 'Our products';
  const galleryBody = plan.body ?? 'Photos from our recent work and products.';

  config.sections = stripPlaceholderPhotoSections(config.sections);

  const targetIdx = resolveTargetSectionForImages(ownerMessage, plan, snapshot);
  if (targetIdx >= 0) {
    const existing = config.sections[targetIdx];
    config.sections[targetIdx] = {
      ...existing,
      type: 'gallery',
      title: plan.title || existing.title || galleryTitle,
      body: plan.body ?? existing.body ?? galleryBody,
      items: newItems,
    };
    return rebuildSiteConfigFile(siteConfigSource, config);
  }

  let out = stripExistingGallerySections(siteConfigSource);
  const reparsed = parseSiteConfigSource(out);
  if (reparsed?.sections) {
    reparsed.sections = stripPlaceholderPhotoSections(reparsed.sections);
    out = rebuildSiteConfigFile(siteConfigSource, reparsed);
  }

  const sectionPayload: Record<string, unknown> = {
    type: 'gallery',
    title: galleryTitle,
    body: galleryBody,
    items: newItems,
  };

  return insertGallerySectionInSiteConfig(
    out,
    sectionPayload,
    placementFromPlan(plan, snapshot)
  );
}

export function describePlacementForOwner(
  plan: ImagePlacementPlan,
  imageCount: number
): string {
  const place =
    plan.action === 'update_section'
      ? `updated "${plan.title}"`
      : plan.insertAfterSectionType
        ? `added "${plan.title}" after your ${plan.insertAfterSectionType} section`
        : `added "${plan.title}" to your homepage`;
  return `${place} with ${imageCount} photo${imageCount === 1 ? '' : 's'}.`;
}

import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import {
  describeSiteConfigParseFailure,
  parseSiteConfigSource,
  rebuildSiteConfigFile,
  replaceSiteConfigSectionsInSource,
} from '@/lib/site-manager/siteConfigParser';
import type { GalleryPlacement } from './gallerySiteConfig';
import {
  humanizeImageItemTitle,
  insertGallerySectionInSiteConfig,
  stripExistingGallerySections,
} from './gallerySiteConfig';
import { stripPlaceholderPhotoSections } from './validateGallerySiteConfig';
import type { ImagePlacementPlan } from './imagePlacementPlan';
import { wantsNewImageSection } from './imagePlacementIntent';
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

function itemHasUploadedImage(item: { imageUrl?: string }): boolean {
  return typeof item.imageUrl === 'string' && item.imageUrl.includes('/uploads/');
}

/** Merge uploads into a gallery section, replacing empty placeholder slots when present. */
export function mergeGallerySectionItems(
  existing: Array<{ title?: string; description?: string; imageUrl?: string }> | undefined,
  attachments: WorkspaceAssetAttachment[],
  titles?: string[]
): Array<{ title: string; imageUrl: string; description?: string }> {
  const incoming = buildItems(attachments, titles);
  if (!existing?.length) return incoming;

  const onlyPlaceholders = existing.every((item) => !itemHasUploadedImage(item));
  if (onlyPlaceholders) {
    const merged: Array<{ title: string; imageUrl: string; description?: string }> = [];
    let attachIdx = 0;
    for (const slot of existing) {
      if (attachIdx < incoming.length) {
        merged.push({
          title: incoming[attachIdx].title,
          imageUrl: incoming[attachIdx].imageUrl,
          description: slot.description,
        });
        attachIdx += 1;
      }
    }
    while (attachIdx < incoming.length) {
      merged.push(incoming[attachIdx]);
      attachIdx += 1;
    }
    return merged.length > 0 ? merged : incoming;
  }

  const kept = existing.filter((item) => itemHasUploadedImage(item)) as Array<{
    title: string;
    imageUrl: string;
    description?: string;
  }>;
  return [...kept, ...incoming];
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
    throw new Error(describeSiteConfigParseFailure(siteConfigSource));
  }

  const galleryTitle = plan.title || 'Our products';
  const galleryBody = plan.body ?? 'Photos from our recent work and products.';

  config.sections = stripPlaceholderPhotoSections(config.sections);

  const targetIdx = resolveTargetSectionForImages(ownerMessage, plan, snapshot);
  if (targetIdx >= 0) {
    const existing = config.sections[targetIdx];
    const mergedItems = mergeGallerySectionItems(existing.items, attachments);
    config.sections[targetIdx] = {
      ...existing,
      type: 'gallery',
      title: plan.title || existing.title || galleryTitle,
      body: plan.body ?? existing.body ?? galleryBody,
      items: mergedItems,
    };
    return (
      replaceSiteConfigSectionsInSource(siteConfigSource, config.sections) ??
      rebuildSiteConfigFile(siteConfigSource, config)
    );
  }

  const preserveExistingGalleries =
    plan.action === 'create_section' && wantsNewImageSection(ownerMessage);

  let out = preserveExistingGalleries
    ? siteConfigSource
    : stripExistingGallerySections(siteConfigSource);
  const reparsed = parseSiteConfigSource(out);
  if (reparsed?.sections && !preserveExistingGalleries) {
    reparsed.sections = stripPlaceholderPhotoSections(reparsed.sections);
    out =
      replaceSiteConfigSectionsInSource(siteConfigSource, reparsed.sections) ?? siteConfigSource;
  }

  const sectionPayload: Record<string, unknown> = {
    type: 'gallery',
    title: galleryTitle,
    body: galleryBody,
    items: buildItems(attachments),
  };

  return insertGallerySectionInSiteConfig(
    out,
    sectionPayload,
    placementFromPlan(plan, snapshot),
    { preserveExistingImageSections: preserveExistingGalleries }
  );
}

export function describePlacementForOwner(
  plan: ImagePlacementPlan,
  imageCount: number,
  options?: { hasHardcodedHero?: boolean; sectionTitle?: string }
): string {
  const title = options?.sectionTitle || plan.title;
  const place =
    plan.action === 'update_section'
      ? `updated "${title}"`
      : plan.insertAfterSectionType
        ? `added "${title}" after your ${plan.insertAfterSectionType} section`
        : `added "${title}" to your homepage`;
  const heroHint =
    options?.hasHardcodedHero && plan.action === 'update_section'
      ? ' Scroll just below the hero to see it.'
      : options?.hasHardcodedHero && plan.action === 'create_section'
        ? ' It appears below the hero on your homepage.'
        : '';
  return `${place} with ${imageCount} photo${imageCount === 1 ? '' : 's'}.${heroHint}`;
}

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
import type { ImagePlacementPlan } from './imagePlacementPlan';
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

function findSectionIndex(
  snapshot: SiteStructureSnapshot,
  plan: ImagePlacementPlan
): number {
  if (plan.targetSectionIndex != null && snapshot.sections[plan.targetSectionIndex]) {
    return plan.targetSectionIndex;
  }
  if (plan.targetSectionTitle) {
    const idx = snapshot.sections.findIndex(
      (s) => s.title.toLowerCase() === plan.targetSectionTitle!.toLowerCase()
    );
    if (idx >= 0) return idx;
  }
  const imgIdx = snapshot.sections.findIndex((s) => s.hasImageItems);
  return imgIdx >= 0 ? imgIdx : -1;
}

/**
 * Apply placement plan to siteConfig source (returns full file content).
 */
export function applyImagePlacementToSiteConfig(
  siteConfigSource: string,
  plan: ImagePlacementPlan,
  attachments: WorkspaceAssetAttachment[],
  snapshot: SiteStructureSnapshot
): string {
  const config = parseSiteConfigSource(siteConfigSource);
  if (!config) {
    return siteConfigSource;
  }

  const newItems = buildItems(attachments);

  if (plan.action === 'update_section') {
    const idx = findSectionIndex(snapshot, plan);
    if (idx < 0 || !config.sections[idx]) {
      return applyImagePlacementToSiteConfig(
        siteConfigSource,
        {
          ...plan,
          action: 'create_section',
          insertAfterSectionType:
            plan.insertAfterSectionType ?? pickPreferredInsertAnchor(snapshot),
        },
        attachments,
        snapshot
      );
    }

    const section = config.sections[idx] as Record<string, unknown>;
    const existing = (section.items as Array<Record<string, unknown>>) ?? [];
    const merged = [...existing];
    for (const item of newItems) {
      const match = merged.find((e) => e.imageUrl === item.imageUrl);
      if (match) {
        Object.assign(match, item);
      } else {
        merged.push(item);
      }
    }
    section.items = merged;
    if (plan.title) section.title = plan.title;
    if (plan.body) section.body = plan.body;
    if (!section.type || section.type === 'generic') {
      section.type = plan.sectionType;
    }

    return rebuildSiteConfigFile(siteConfigSource, config);
  }

  let out = stripExistingGallerySections(siteConfigSource);
  const sectionPayload: Record<string, unknown> = {
    type: plan.sectionType,
    title: plan.title,
    body: plan.body ?? '',
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

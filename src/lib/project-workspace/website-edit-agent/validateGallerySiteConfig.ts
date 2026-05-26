import {
  describeSiteConfigParseFailure,
  parseSiteConfigSource,
} from '@/lib/site-manager/siteConfigParser';
import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';

export function sectionItemsHaveImageUrls(
  items?: Array<{ imageUrl?: string }>
): boolean {
  return (items ?? []).some(
    (i) => typeof i.imageUrl === 'string' && i.imageUrl.includes('/uploads/')
  );
}

/** Remove mistaken product blocks (titles only, no imageUrl) from failed prior edits. */
export function stripPlaceholderPhotoSections(
  sections: Array<{ type?: string; title?: string; items?: Array<{ title?: string; imageUrl?: string }> }>
) {
  const filtered = sections.filter((s) => {
    const items = s.items ?? [];
    if (items.length === 0) return true;
    const allPlaceholder =
      items.every(
        (i) =>
          !i.imageUrl &&
          (!i.title || /^photo\s*\d+$/i.test(i.title.trim()) || i.title.length < 20)
      ) && items.length <= 8;
    const productTitle = /product|gallery|documentation|our work/i.test(String(s.title ?? ''));
    if (allPlaceholder && productTitle) {
      return false;
    }
    return true;
  });
  if (filtered.length === 0 && sections.length > 0) {
    return sections;
  }
  return filtered;
}

/**
 * Confirms siteConfig contains a gallery section with every uploaded image URL.
 */
export function validateGalleryInSiteConfigSource(
  siteConfigSource: string,
  attachments: WorkspaceAssetAttachment[]
): { ok: boolean; reason: string } {
  const config = parseSiteConfigSource(siteConfigSource);
  if (!config) {
    const hint = describeSiteConfigParseFailure(siteConfigSource);
    const snippet = siteConfigSource.replace(/\s+/g, ' ').slice(0, 200);
    return {
      ok: false,
      reason: `siteConfig parse failed: ${hint} (snippet: ${snippet})`,
    };
  }
  if (!config.sections?.length) {
    return { ok: false, reason: 'siteConfig has no sections' };
  }

  const gallerySection = config.sections.find(
    (s) =>
      String(s.type ?? '').toLowerCase() === 'gallery' ||
      sectionItemsHaveImageUrls(s.items)
  );

  if (!gallerySection) {
    return { ok: false, reason: 'No gallery section with imageUrl items in siteConfig' };
  }

  if (String(gallerySection.type ?? '').toLowerCase() !== 'gallery') {
    return {
      ok: false,
      reason: `Image section has type "${gallerySection.type}" but must be "gallery" for the page renderer`,
    };
  }

  const missing = attachments.filter(
    (a) => !(gallerySection.items ?? []).some((i) => i.imageUrl === a.publicUrl)
  );

  if (missing.length > 0) {
    const inFile = missing.filter((a) => siteConfigSource.includes(a.publicUrl));
    if (inFile.length === 0) {
      return {
        ok: false,
        reason: `${missing.length} image URL(s) missing from siteConfig`,
      };
    }
    return {
      ok: false,
      reason: 'imageUrl paths present in file but not on gallery section items',
    };
  }

  return {
    ok: true,
    reason: `Gallery section "${gallerySection.title}" has ${attachments.length} image(s)`,
  };
}

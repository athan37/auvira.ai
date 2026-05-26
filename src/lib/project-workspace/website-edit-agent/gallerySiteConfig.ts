import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import {
  parseSiteConfigSource,
  rebuildSiteConfigFile,
  replaceSiteConfigSectionsInSource,
  type ParsedSiteConfig,
} from '@/lib/site-manager/siteConfigParser';
import {
  appendSiteConfigGallerySyncExport,
  SITECONFIG_GALLERY_SYNC_MARKER,
} from '@/lib/site-manager/siteConfigAgentMarkers';
import { ensureSiteConfigTypesSupportGallery } from '@/lib/builder/siteConfigTypes';
import { stripPlaceholderPhotoSections } from './validateGallerySiteConfig';

export type GalleryPlacement = 'prepend' | `after:${string}`;

export { SITECONFIG_GALLERY_SYNC_MARKER };

/** Bump a dedicated export so siteConfig.ts changes without breaking parse. */
export function stampSiteConfigForGalleryPreviewReload(siteConfigSource: string): string {
  return appendSiteConfigGallerySyncExport(siteConfigSource);
}

export function inferGallerySectionTitle(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('documentation') || lower.includes('document')) {
    return 'Product documentation';
  }
  if (lower.includes('product')) {
    return 'Our products';
  }
  if (lower.includes('gallery')) {
    return 'Gallery';
  }
  return 'Our work';
}

export function inferGallerySectionBody(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('important')) {
    return 'A closer look at our products and on-site work.';
  }
  if (lower.includes('documentation')) {
    return 'Reference photos and documentation from the field.';
  }
  return 'Photos from recent projects and product highlights.';
}

/** Avoid ugly raw filenames like "3.17" as visible titles. */
export function humanizeImageItemTitle(originalName: string, index: number): string {
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || /^[\d.\s]+$/.test(base) || base.length < 3) {
    return `Photo ${index + 1}`;
  }
  return base
    .split(' ')
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .slice(0, 48);
}

export function inferGalleryPlacement(message: string, siteConfigSource: string): GalleryPlacement {
  const lower = message.toLowerCase();
  if (/\b(top|hero|below hero|under hero|first)\b/.test(lower)) {
    return 'prepend';
  }
  if (/\b(after about|below about|in about)\b/.test(lower)) {
    return 'after:about';
  }
  if (/\b(after feature|below feature)\b/.test(lower)) {
    return 'after:features';
  }
  if (/\b(after service|below service|under service)\b/.test(lower)) {
    return 'after:services';
  }

  if (/"type":\s*"services"/.test(siteConfigSource)) {
    return 'after:services';
  }
  if (/"type":\s*"about"/.test(siteConfigSource)) {
    return 'after:about';
  }
  return 'prepend';
}

/** Remove prior generic/gallery blocks that already show uploaded images. */
export function stripExistingGallerySections(siteConfigSource: string): string {
  let out = siteConfigSource;
  const patterns = [
    /\n    \{\n      "type": "(?:generic|gallery|documentation)",[\s\S]*?imageUrl[\s\S]*?\n    \},?/g,
    /\{\s*"type":\s*"(?:generic|gallery|documentation)"[\s\S]*?imageUrl[\s\S]*?\},?/g,
  ];
  let prev = '';
  while (prev !== out) {
    prev = out;
    for (const pattern of patterns) {
      out = out.replace(pattern, '');
    }
  }
  return out.replace(/,\s*,/g, ',').replace(/\[\s*,/g, '[');
}

function sectionHasImageUrl(
  section: ParsedSiteConfig['sections'][number]
): boolean {
  return (section.items ?? []).some(
    (i) => typeof i.imageUrl === 'string' && i.imageUrl.length > 0
  );
}

function stripGallerySectionsParsed(sections: ParsedSiteConfig['sections']) {
  return sections.filter((s) => {
    const t = String(s.type ?? '').toLowerCase();
    if (t === 'gallery') return false;
    return !sectionHasImageUrl(s);
  });
}

/**
 * Place gallery in a natural scroll position (default: after Services), not always directly under hero.
 */
export function insertGallerySectionInSiteConfig(
  siteConfigSource: string,
  section: Record<string, unknown>,
  placement?: GalleryPlacement,
  options?: { preserveExistingImageSections?: boolean }
): string {
  const place = placement ?? inferGalleryPlacement('', siteConfigSource);
  const config = parseSiteConfigSource(siteConfigSource);

  if (config?.sections) {
    let sections = options?.preserveExistingImageSections
      ? [...config.sections]
      : stripGallerySectionsParsed([...config.sections]);
    sections = stripPlaceholderPhotoSections(sections);
    const newSection = {
      ...(section as ParsedSiteConfig['sections'][number]),
      type: 'gallery',
    };

    if (place === 'prepend') {
      sections.unshift(newSection);
    } else {
      const afterType = place.replace('after:', '').toLowerCase();
      const idx = sections.findIndex(
        (s) => String(s.type ?? '').toLowerCase() === afterType
      );
      if (idx >= 0) {
        sections.splice(idx + 1, 0, newSection);
      } else {
        sections.unshift(newSection);
      }
    }

    config.sections = sections;
    return (
      replaceSiteConfigSectionsInSource(siteConfigSource, sections) ??
      rebuildSiteConfigFile(siteConfigSource, config)
    );
  }

  // Fallback: regex path when parse fails
  const sectionBlock = JSON.stringify(section, null, 2)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
  let out = stripExistingGallerySections(siteConfigSource);
  if (place === 'prepend') {
    out = out.replace(/"sections"\s*:\s*\[\s*\n?/, `"sections": [\n${sectionBlock},\n`);
  }
  return ensureSiteConfigTypesSupportGallery(out);
}

/** @deprecated Use insertGallerySectionInSiteConfig */
export function prependGallerySectionInSiteConfig(
  siteConfigSource: string,
  section: Record<string, unknown>
): string {
  return insertGallerySectionInSiteConfig(siteConfigSource, section, 'prepend');
}

export function buildGallerySectionPayload(
  attachments: WorkspaceAssetAttachment[],
  ownerMessage: string
): Record<string, unknown> {
  return {
    type: 'gallery',
    title: inferGallerySectionTitle(ownerMessage),
    body: inferGallerySectionBody(ownerMessage),
    items: attachments.map((asset, index) => ({
      title: humanizeImageItemTitle(asset.originalName, index),
      imageUrl: asset.publicUrl,
    })),
  };
}

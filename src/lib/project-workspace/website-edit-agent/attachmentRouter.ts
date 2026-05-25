import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runHeroImageStrategy } from './heroImageStrategy';
import { runImageGallerySectionStrategy } from './imageGallerySectionStrategy';
import { runStaticImageGalleryStrategy } from './staticImageGalleryStrategy';
import { isHeroImageRequest } from './heroImageStrategy';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

/**
 * Attachment-first routing: image pipelines before intent-based section routing.
 */
export async function routeAttachmentEdits(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (attachments.length === 0) {
    return null;
  }

  if (options.mode === 'gitlab') {
    const galleryCaptions = await runGalleryItemDescriptionStrategy(options, beforeHashes);
    if (galleryCaptions) {
      return galleryCaptions;
    }
  }

  if (options.mode === 'static') {
    return runStaticImageGalleryStrategy(options, beforeHashes);
  }

  if (options.mode === 'gitlab') {
    if (isHeroImageRequest(options.ownerMessage, attachments.length)) {
      const hero = await runHeroImageStrategy(options, beforeHashes);
      if (hero) return hero;
    }
    return runImageGallerySectionStrategy(options, beforeHashes);
  }

  return null;
}

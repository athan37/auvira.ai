import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runHeroImageStrategy } from './heroImageStrategy';
import { runImageGallerySectionStrategy } from './imageGallerySectionStrategy';
import { isHeroImageRequest } from './heroImageStrategy';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

/**
 * Attachment-first routing: image pipelines before planner (GitLab workspaces only).
 */
export async function routeAttachmentEdits(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (attachments.length === 0) {
    return null;
  }

  const galleryCaptions = await runGalleryItemDescriptionStrategy(options, beforeHashes);
  if (galleryCaptions) {
    return galleryCaptions;
  }

  if (isHeroImageRequest(options.ownerMessage, attachments.length)) {
    const hero = await runHeroImageStrategy(options, beforeHashes);
    if (hero) return hero;
  }
  return runImageGallerySectionStrategy(options, beforeHashes);
}

import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runHeroImageStrategy, isHeroImageRequest } from './heroImageStrategy';
import { runImageGallerySectionStrategy } from './imageGallerySectionStrategy';
import {
  isCaptionOnlyFollowUp,
  isCompoundImagePlacementAndCaption,
} from './imageEditIntent';
import { isImagePlacementRequest, wantsNewImageSection } from './imagePlacementIntent';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

function mergeChangedFiles(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

/**
 * Placement then captions for compound image+description requests in one turn.
 */
export async function runImageGalleryThenCaptions(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const placement = await runImageGallerySectionStrategy(options, beforeHashes);
  if (!placement?.ok) return placement;

  const midHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);

  const captionMessage =
    options.ownerMessage.match(/\b2[\).:]\s*(.+)$/i)?.[1]?.trim() ??
    options.ownerMessage.match(/\balso\b\s*(.+)$/i)?.[1]?.trim() ??
    'add descriptions to the uploaded images';

  const captionResult = await runGalleryItemDescriptionStrategy(
    {
      ...options,
      ownerMessage: captionMessage,
      attachments: [],
      lastGalleryEdit: placement.lastGalleryEdit ?? options.lastGalleryEdit,
    },
    midHashes
  );

  if (!captionResult?.ok) {
    return placement;
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);

  return {
    ok: true,
    strategy: 'gallery_captions',
    summary: captionResult.summary ?? captionResult.ownerMessage,
    ownerMessage: captionResult.ownerMessage ?? placement.ownerMessage,
    changedFiles: mergeChangedFiles(placement.changedFiles, captionResult.changedFiles),
    lastGalleryEdit: captionResult.lastGalleryEdit ?? placement.lastGalleryEdit,
  };
}

/**
 * Attachment-first image routing: placement before captions; compound runs both.
 */
export async function routeAttachmentEdits(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  const hasAttachments = attachments.length > 0;
  const wantsPlacement =
    hasAttachments &&
    (isImagePlacementRequest(options.ownerMessage) ||
      wantsNewImageSection(options.ownerMessage) ||
      isCompoundImagePlacementAndCaption(options.ownerMessage));

  if (wantsPlacement && isCompoundImagePlacementAndCaption(options.ownerMessage)) {
    return runImageGalleryThenCaptions(options, beforeHashes);
  }

  if (wantsPlacement) {
    if (isHeroImageRequest(options.ownerMessage, attachments.length)) {
      const hero = await runHeroImageStrategy(options, beforeHashes);
      if (hero) return hero;
    }
    return runImageGallerySectionStrategy(options, beforeHashes);
  }

  if (isCaptionOnlyFollowUp(options.ownerMessage, hasAttachments)) {
    const galleryCaptions = await runGalleryItemDescriptionStrategy(options, beforeHashes);
    if (galleryCaptions) return galleryCaptions;
  }

  if (hasAttachments) {
    if (isHeroImageRequest(options.ownerMessage, attachments.length)) {
      const hero = await runHeroImageStrategy(options, beforeHashes);
      if (hero) return hero;
    }
    return runImageGallerySectionStrategy(options, beforeHashes);
  }

  return null;
}

import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runHeroImageStrategy, isHeroImageRequest } from './heroImageStrategy';
import { runImageGallerySectionStrategy } from './imageGallerySectionStrategy';
import {
  applyCompoundGalleryCaptionFallback,
  extractLastGalleryEditFromSiteConfig,
  isCaptionOnlyFollowUp,
  isCompoundImagePlacementAndCaption,
} from './imageEditIntent';
import { isImagePlacementRequest, wantsNewImageSection } from './imagePlacementIntent';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';

function mergeChangedFiles(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

async function readSiteConfig(options: WebsiteEditAgentOptions): Promise<string | null> {
  try {
    return options.gateway
      ? await options.gateway.readFile(SITE_CONFIG)
      : await fs.readFile(path.join(options.workspacePath, SITE_CONFIG), 'utf-8');
  } catch {
    return null;
  }
}

async function writeSiteConfig(options: WebsiteEditAgentOptions, content: string): Promise<void> {
  if (options.gateway) {
    await options.gateway.writeFile(SITE_CONFIG, content);
    return;
  }
  await fs.writeFile(path.join(options.workspacePath, SITE_CONFIG), content, 'utf-8');
}

function extractCompoundCaptionMessage(ownerMessage: string): string {
  return (
    ownerMessage.match(/\b2[\).:]\s*(.+)$/i)?.[1]?.trim() ??
    ownerMessage.match(/\balso\b\s*(.+)$/i)?.[1]?.trim() ??
    'add descriptions to the uploaded images'
  );
}

async function applyCompoundCaptionFallback(
  options: WebsiteEditAgentOptions,
  placement: WebsiteEditAgentResult,
  captionMessage: string,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const siteConfig = await readSiteConfig(options);
  if (!siteConfig) return null;

  const lastGalleryEdit =
    placement.lastGalleryEdit ??
    extractLastGalleryEditFromSiteConfig(
      siteConfig,
      (options.attachments ?? []).map((attachment) => attachment.publicUrl)
    );
  if (!lastGalleryEdit) return null;

  const updated = applyCompoundGalleryCaptionFallback(
    siteConfig,
    lastGalleryEdit,
    captionMessage
  );
  if (!updated) return null;

  await writeSiteConfig(options, updated);

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) return null;

  return {
    ok: true,
    strategy: 'gallery_captions',
    summary: 'Added descriptions under your product images.',
    ownerMessage: 'Added descriptions under your product images.',
    changedFiles: mergeChangedFiles(placement.changedFiles, changedFiles),
    lastGalleryEdit,
    editMeta: { lastGalleryEdit },
  };
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

  const captionMessage = extractCompoundCaptionMessage(options.ownerMessage);

  const captionResult = await runGalleryItemDescriptionStrategy(
    {
      ...options,
      ownerMessage: captionMessage,
      attachments: [],
      lastGalleryEdit: placement.lastGalleryEdit ?? options.lastGalleryEdit,
    },
    midHashes
  );

  if (captionResult?.ok) {
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

  const fallback = await applyCompoundCaptionFallback(
    options,
    placement,
    captionMessage,
    beforeHashes
  );
  if (fallback?.ok) return fallback;

  return placement;
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
    if (galleryCaptions?.ok || galleryCaptions?.needsClarification) {
      return galleryCaptions;
    }
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

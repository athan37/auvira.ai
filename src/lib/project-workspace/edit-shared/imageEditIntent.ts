import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { isGalleryDescriptionRequest } from './galleryItemDescriptionStrategy';
import { isImagePlacementRequest, wantsNewImageSection } from './imagePlacementIntent';
import type { ConversationTurn, LastGalleryEdit } from './types';
import type { EditFocusStack } from './editFocus';
import { sectionIndexFromFocusStack } from './editFocus';

export interface GalleryCaptionTarget extends LastGalleryEdit {
  missingDescriptionCount: number;
}

const CAPTION_WORD =
  /\b(description|descriptions|caption|captions|blurb|label|labels|text under|underneath|write a short)\b/i;
const PLACEMENT_WORD =
  /\b(add|put|place|insert|attach|upload|show|create|new|make)\b[\s\S]{0,60}\b(image|images|photo|photos|section|gallery|pic|pics)\b/i;
const NUMBERED_PARTS = /\b1[\).:]\s*[\s\S]+?\b2[\).:]/i;

/** Single message with both image placement and caption intent (e.g. "1) add image 2) add description"). */
export function isCompoundImagePlacementAndCaption(message: string): boolean {
  const lower = message.toLowerCase();
  const hasCaption = CAPTION_WORD.test(lower);
  const hasPlacement =
    isImagePlacementRequest(message) ||
    wantsNewImageSection(message) ||
    PLACEMENT_WORD.test(lower);
  if (!hasCaption || !hasPlacement) return false;
  return (
    NUMBERED_PARTS.test(message) ||
    (/\band\b/i.test(lower) && hasCaption && hasPlacement) ||
    (/\balso\b/i.test(lower) && hasCaption && hasPlacement)
  );
}

function galleryTitleMentionedInMessage(
  message: string,
  candidates: GalleryCaptionTarget[]
): GalleryCaptionTarget | null {
  const lower = message.toLowerCase();
  const quoted = [...message.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.trim().toLowerCase());
  for (const candidate of candidates) {
    const title = candidate.title.toLowerCase();
    if (quoted.includes(title) || lower.includes(title)) {
      return candidate;
    }
  }
  return null;
}

function disambiguateByGalleryMetadata(
  matching: GalleryCaptionTarget[],
  lastGalleryEdit?: LastGalleryEdit | null
): GalleryCaptionTarget | null {
  if (matching.length <= 1 || !lastGalleryEdit) {
    return matching[matching.length - 1] ?? null;
  }
  const byIndex = matching.find((c) => c.sectionIndex === lastGalleryEdit.sectionIndex);
  if (byIndex) return byIndex;
  const byUrls = matching.find((c) =>
    lastGalleryEdit.imageUrls.some((url) => c.imageUrls.includes(url))
  );
  if (byUrls) return byUrls;
  return matching[matching.length - 1] ?? null;
}

/** Caption follow-up without new uploads or new section placement. */
export function isCaptionOnlyFollowUp(message: string, hasAttachments: boolean): boolean {
  if (!isGalleryDescriptionRequest(message)) return false;
  if (hasAttachments && (isImagePlacementRequest(message) || wantsNewImageSection(message))) {
    return false;
  }
  if (isCompoundImagePlacementAndCaption(message)) return false;
  return true;
}

function itemHasImageUrl(item: { imageUrl?: string }): boolean {
  return typeof item.imageUrl === 'string' && item.imageUrl.includes('/uploads/');
}

function itemHasDescription(item: { description?: string }): boolean {
  return typeof item.description === 'string' && item.description.trim().length > 0;
}

function gallerySectionsFromConfig(siteConfigContent: string): GalleryCaptionTarget[] {
  const config = parseSiteConfigSource(siteConfigContent);
  if (!config?.sections?.length) return [];

  const results: GalleryCaptionTarget[] = [];
  config.sections.forEach((section, sectionIndex) => {
    const items = section.items ?? [];
    const imageItems = items.filter(itemHasImageUrl);
    if (imageItems.length === 0) return;

    const imageUrls = imageItems.map((i) => String(i.imageUrl));
    const missingDescriptionCount = imageItems.filter((i) => !itemHasDescription(i)).length;
    results.push({
      sectionIndex,
      title: String(section.title ?? `section ${sectionIndex + 1}`),
      imageUrls,
      imageCount: imageItems.length,
      missingDescriptionCount,
    });
  });
  return results;
}

function extractGalleryImageCountFromAssistant(content: string): number | null {
  const match = content.match(/(\d+)\s+image/i);
  if (!match?.[1]) return null;
  const count = parseInt(match[1], 10);
  return Number.isFinite(count) && count > 0 ? count : null;
}

export function wasRecentGalleryImageSectionCreated(history: ConversationTurn[]): boolean {
  return history.some(
    (turn) =>
      turn.role === 'assistant' &&
      (/product section with \d+ image/i.test(turn.content) ||
        /Added your product section/i.test(turn.content) ||
        /gallery section with \d+ image/i.test(turn.content) ||
        /image\(s\) in the preview/i.test(turn.content) ||
        /images are live/i.test(turn.content) ||
        /uploaded successfully/i.test(turn.content) ||
        /your images.*preview/i.test(turn.content))
  );
}

function imageCountFromHistory(history: ConversationTurn[] | undefined): number | null {
  if (!history?.length) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const count = extractGalleryImageCountFromAssistant(turn.content);
    if (count != null) return count;
  }
  return null;
}

/**
 * Pick the gallery section to caption — prefers last matching section by image count from chat.
 */
export function resolveTargetGalleryForCaptions(
  siteConfigContent: string,
  history?: ConversationTurn[],
  lastGalleryEdit?: LastGalleryEdit | null,
  ownerMessage?: string,
  editFocusStack?: EditFocusStack | null,
  selectedTarget?: import('./selectedTargetTypes').SelectedTargetInput | null
): GalleryCaptionTarget | null {
  const candidates = gallerySectionsFromConfig(siteConfigContent);
  if (candidates.length === 0) return null;

  if (selectedTarget?.kind === 'section' && selectedTarget.sectionType === 'gallery') {
    const fromSelected =
      selectedTarget.sectionIndex != null
        ? candidates.find((c) => c.sectionIndex === selectedTarget.sectionIndex)
        : undefined;
    if (fromSelected) return fromSelected;
  }

  if (ownerMessage) {
    const titled = galleryTitleMentionedInMessage(ownerMessage, candidates);
    if (titled) return titled;
  }

  const focusIndex = sectionIndexFromFocusStack(editFocusStack);
  if (focusIndex != null) {
    const fromFocus = candidates.find((c) => c.sectionIndex === focusIndex);
    if (fromFocus) return fromFocus;
  }

  if (lastGalleryEdit) {
    const fromMeta = candidates.find((c) => c.sectionIndex === lastGalleryEdit.sectionIndex);
    if (fromMeta) return fromMeta;
  }

  const historyCount = imageCountFromHistory(history);
  if (historyCount != null) {
    const matching = candidates.filter((c) => c.imageCount === historyCount);
    if (matching.length > 0) {
      const withMissing = matching.filter((c) => c.missingDescriptionCount > 0);
      const pool = withMissing.length > 0 ? withMissing : matching;
      return disambiguateByGalleryMetadata(pool, lastGalleryEdit);
    }
  }

  if (history && wasRecentGalleryImageSectionCreated(history)) {
    const withMissing = candidates.filter((c) => c.missingDescriptionCount > 0);
    if (withMissing.length > 0) return withMissing[withMissing.length - 1]!;
  }

  return candidates[candidates.length - 1] ?? null;
}

/** Build lastGalleryEdit artifact from siteConfig after a successful image placement. */
export function extractLastGalleryEditFromSiteConfig(
  siteConfigContent: string,
  attachmentUrls: string[]
): LastGalleryEdit | null {
  const candidates = gallerySectionsFromConfig(siteConfigContent);
  if (candidates.length === 0) return null;

  const urlSet = new Set(attachmentUrls);
  const batchMatch = candidates.find((c) =>
    attachmentUrls.every((url) => c.imageUrls.includes(url))
  );
  if (batchMatch) {
    return {
      sectionIndex: batchMatch.sectionIndex,
      title: batchMatch.title,
      imageUrls: batchMatch.imageUrls,
      imageCount: batchMatch.imageCount,
    };
  }

  const partialMatch = candidates.find((c) =>
    c.imageUrls.some((url) => urlSet.has(url))
  );
  if (partialMatch) {
    return {
      sectionIndex: partialMatch.sectionIndex,
      title: partialMatch.title,
      imageUrls: partialMatch.imageUrls,
      imageCount: partialMatch.imageCount,
    };
  }

  const last = candidates[candidates.length - 1]!;
  return {
    sectionIndex: last.sectionIndex,
    title: last.title,
    imageUrls: last.imageUrls,
    imageCount: last.imageCount,
  };
}

/** Deterministic placeholder descriptions when LLM caption edit fails. */
export function applyPlaceholderGalleryDescriptions(
  siteConfigContent: string,
  target: GalleryCaptionTarget
): string | null {
  const config = parseSiteConfigSource(siteConfigContent);
  if (!config?.sections?.[target.sectionIndex]) return null;

  const section = config.sections[target.sectionIndex];
  const items = section.items ?? [];
  let changed = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as { title?: string; imageUrl?: string; description?: string };
    if (!itemHasImageUrl(item) || itemHasDescription(item)) continue;
    const label = item.title?.trim() || `Image ${i + 1}`;
    item.description = `${label} — add your caption here.`;
    changed = true;
  }

  if (!changed) return null;

  const literal = JSON.stringify(config, null, 2);
  if (siteConfigContent.includes('export const siteConfig')) {
    return siteConfigContent.replace(
      /export const siteConfig\s*=\s*\{[\s\S]*\};?\s*$/,
      `export const siteConfig = ${literal};`
    );
  }
  return null;
}

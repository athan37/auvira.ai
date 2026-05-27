/** Shared detection for owner image-placement language (upload vs caption vs new section). */

const IMAGE_NOUN =
  /\b(image|images|photo|photos|picture|pictures|pic|pics|upload|uploads)\b/i;

/**
 * Owner wants to place or add images (not caption-only follow-ups).
 * Used when attachments.length === 0 to block silent reuse of existing /uploads/ URLs.
 */
export function isImagePlacementRequest(message: string): boolean {
  const lower = message.toLowerCase();
  if (
    /\b(description|descriptions|caption|captions)\b/.test(lower) &&
    IMAGE_NOUN.test(lower)
  ) {
    return false;
  }
  return (
    /\b(this|these|the)\s+(image|images|photo|photos|picture|pictures)\b/i.test(lower) ||
    /\b(add|put|place|insert|attach|upload|show)\b[\s\S]{0,40}\b(image|images|photo|photos|picture|pictures)\b/i.test(
      lower
    ) ||
    /\b(image|images|photo|photos|picture|pictures)\b[\s\S]{0,40}\b(to|in|into|on)\b/i.test(
      lower
    ) ||
    (/\bfirst\s+section\b/i.test(lower) && IMAGE_NOUN.test(lower)) ||
    (/\b(section|gallery|hero)\b/i.test(lower) && IMAGE_NOUN.test(lower) && /\badd\b/i.test(lower))
  );
}

/** Owner asked for a separate gallery block, not updating the existing image section. */
export function wantsNewImageSection(message: string): boolean {
  const lower = message.toLowerCase();
  const mentionsImage = IMAGE_NOUN.test(lower);
  return (
    (/\bcreate\s+(a\s+)?new\s+section\b/i.test(lower) && mentionsImage) ||
    /\b(another|new|different|separate|second)\s+gallery\b/i.test(lower) ||
    (/\b(another|new|different|separate|second)\s+(section|block)\b/i.test(lower) &&
      mentionsImage) ||
    (/\bnew\s+section\s+for\b/i.test(lower) && mentionsImage) ||
    (/\binto\s+(a\s+)?new\s+section\b/i.test(lower) && mentionsImage) ||
    /\badd\s+(these|those)\s+images?\s+to\s+another\b/i.test(lower) ||
    /\badd\s+(these|those)\s+images?\s+into\s+(a\s+)?new\s+section\b/i.test(lower)
  );
}

export const MISSING_IMAGE_ATTACHMENT_MESSAGE =
  'Please attach the image(s) you want to use, then send your message again.';

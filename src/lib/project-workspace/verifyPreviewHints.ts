/** Shared hint extraction for preview-first edit verification. */

import { stripPinnedTargetSuffix } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { isGradientBackgroundRequest } from '@/lib/project-workspace/edit-shared/preset/presetUtils';

const COLOR_NAMES = [
  'green',
  'yellow',
  'blue',
  'red',
  'orange',
  'purple',
  'pink',
  'brown',
  'black',
  'white',
  'teal',
  'cyan',
  'indigo',
  'gray',
  'grey',
] as const;

export interface PreviewVerifyHints {
  colors: string[];
  phrases: string[];
  isStyleRequest: boolean;
  isCopyRequest: boolean;
  /** Headline/title/text color (not page background). */
  isTextColorRequest: boolean;
  /** Explicit background or generic color styling. */
  isBackgroundColorRequest: boolean;
}

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Match Tailwind bg/text/from/to/via classes and gradient stops in rendered HTML. */
export function htmlShowsTailwindColor(html: string, color: string): boolean {
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(
      `(?:bg-|text-|from-|to-|via-)${escaped}(?:-[0-9]{2,3})?(?:\\s|"|'|/)`,
      'i'
    ).test(html) ||
    new RegExp(`(?:^|[\\s/"'])${escaped}-[0-9]{2,3}(?:\\s|"|'|/)`, 'i').test(html) ||
    new RegExp(`\\[#([0-9a-f]{3,8})\\][^<]*${escaped}`, 'i').test(html)
  );
}

/** True when the prompt targets headline/title/text color, not page background. */
export function isTextColorEditRequest(ownerMessage: string): boolean {
  const normalized = stripPinnedTargetSuffix(ownerMessage);
  const lower = normalized.toLowerCase();
  const hasColor = COLOR_NAMES.some((c) => messageHasKeyword(lower, c));
  if (!hasColor || messageHasKeyword(lower, 'background')) {
    return false;
  }
  return (
    messageHasKeyword(lower, 'headline') ||
    messageHasKeyword(lower, 'heading') ||
    messageHasKeyword(lower, 'title') ||
    messageHasKeyword(lower, 'text')
  );
}

/** True when the prompt targets visible background / generic color styling. */
export function isBackgroundColorEditRequest(ownerMessage: string): boolean {
  const normalized = stripPinnedTargetSuffix(ownerMessage);
  if (isGradientBackgroundRequest(normalized)) {
    return true;
  }
  const lower = normalized.toLowerCase();
  const hasColor = COLOR_NAMES.some((c) => messageHasKeyword(lower, c));
  if (!hasColor || isTextColorEditRequest(ownerMessage)) {
    return false;
  }
  return (
    messageHasKeyword(lower, 'background') ||
    messageHasKeyword(lower, 'colour') ||
    messageHasKeyword(lower, 'color')
  );
}

/** Pull quoted phrases and color words from the owner message. */
export function extractPreviewVerifyHints(ownerMessage: string): PreviewVerifyHints {
  const lower = ownerMessage.toLowerCase();
  const phrases: string[] = [];

  const quoted = ownerMessage.matchAll(/["']([^"']{4,120})["']/g);
  for (const m of quoted) {
    if (m[1]?.trim()) phrases.push(m[1].trim());
  }

  const colors = COLOR_NAMES.filter((c) => messageHasKeyword(lower, c));

  const isStyleRequest =
    messageHasKeyword(lower, 'background') ||
    messageHasKeyword(lower, 'colour') ||
    messageHasKeyword(lower, 'color') ||
    messageHasKeyword(lower, 'font') ||
    colors.length > 0;

  const isCopyRequest =
    messageHasKeyword(lower, 'headline') ||
    messageHasKeyword(lower, 'title') ||
    messageHasKeyword(lower, 'wording') ||
    messageHasKeyword(lower, 'text') ||
    phrases.length > 0;

  const isTextColorRequest = isTextColorEditRequest(ownerMessage);
  const isBackgroundColorRequest = isBackgroundColorEditRequest(ownerMessage);

  return {
    colors,
    phrases,
    isStyleRequest,
    isCopyRequest,
    isTextColorRequest,
    isBackgroundColorRequest,
  };
}

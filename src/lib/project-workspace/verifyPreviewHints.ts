/** Shared hint extraction for preview-first edit verification. */

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
}

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Match Tailwind bg/from/to/via classes and gradient stops in rendered HTML. */
export function htmlShowsTailwindColor(html: string, color: string): boolean {
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`(?:bg-|from-|to-|via-)${escaped}(?:-[0-9]{2,3})?(?:\\s|"|'|/)`, 'i').test(html) ||
    new RegExp(`(?:^|[\\s/"'])${escaped}-[0-9]{2,3}(?:\\s|"|'|/)`, 'i').test(html) ||
    new RegExp(`\\[#([0-9a-f]{3,8})\\][^<]*${escaped}`, 'i').test(html)
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

  return { colors, phrases, isStyleRequest, isCopyRequest };
}

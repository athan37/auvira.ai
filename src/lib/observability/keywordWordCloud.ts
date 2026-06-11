import { capitalizeKeywordDisplay } from './keywordDisplay';
import type { MonitorIntentProfileView } from './parseIntentProfile';

/** Client-side keyword interest classes (mirrors static/demo renderKeywordCloud). */
export type KeywordInterestClass = 'kw-color-style' | 'kw-meta-interest' | 'kw-general';

export const KEYWORD_CLOUD_FONT_MAX_REM = 2.1;
export const KEYWORD_CLOUD_FONT_MIN_REM = 0.7;

export interface KeywordWordCloudItem {
  raw: string;
  display: string;
  rank: number;
  interestClass: KeywordInterestClass;
  fontSizeRem: number;
}

export interface IntentProfileRenderModel {
  turnCount: number;
  scope?: string;
  updatedAt?: string;
  cloudItems: KeywordWordCloudItem[];
  intents: string[];
}

const COLOR_NAME_TOKENS = new Set([
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
  'black',
  'white',
  'gray',
  'grey',
  'navy',
  'teal',
  'cyan',
  'gold',
  'brown',
  'beige',
  'maroon',
  'lime',
  'indigo',
  'violet',
  'magenta',
  'coral',
  'crimson',
  'amber',
  'emerald',
  'rose',
  'slate',
  'ivory',
  'charcoal',
]);

/** Map raw keyword token to cloud interest class (client-side only). */
export function kwClass(keyword: string): KeywordInterestClass {
  const lower = keyword.trim().toLowerCase();
  if (
    lower === 'favorite' ||
    lower === 'favourite' ||
    lower === 'color' ||
    lower === 'colour'
  ) {
    return 'kw-meta-interest';
  }
  if (
    lower.startsWith('gradient-') ||
    lower.includes('gradient') ||
    COLOR_NAME_TOKENS.has(lower)
  ) {
    return 'kw-color-style';
  }
  return 'kw-general';
}

/** Map keyword rank to rem font size (index 0 = largest). */
export function keywordWordCloudFontSizeRem(rank: number, total: number): number {
  if (total <= 1) return KEYWORD_CLOUD_FONT_MAX_REM;
  const t = Math.min(Math.max(rank, 0), total - 1) / (total - 1);
  return KEYWORD_CLOUD_FONT_MAX_REM - t * (KEYWORD_CLOUD_FONT_MAX_REM - KEYWORD_CLOUD_FONT_MIN_REM);
}

/** Build ranked cloud items from intent.keywords[] (array order = weight). */
export function buildKeywordWordCloudItems(keywords: string[]): KeywordWordCloudItem[] {
  return keywords.map((raw, rank) => ({
    raw,
    display: capitalizeKeywordDisplay(raw),
    rank,
    interestClass: kwClass(raw),
    fontSizeRem: keywordWordCloudFontSizeRem(rank, keywords.length),
  }));
}

/**
 * Prepare intent profile view model for the Tracked intent profile panel
 * (meta chips, keyword cloud, classified edit types).
 */
export function renderIntentProfile(
  intent: MonitorIntentProfileView | null | undefined
): IntentProfileRenderModel | null {
  if (!intent) return null;
  return {
    turnCount: intent.turnCount,
    scope: intent.scope,
    updatedAt: intent.updatedAt,
    cloudItems: buildKeywordWordCloudItems(intent.keywords),
    intents: intent.intents,
  };
}

/** Tailwind styles for each kw-* interest class (existing dashboard palette). */
export function keywordInterestClassName(interestClass: KeywordInterestClass): string {
  switch (interestClass) {
    case 'kw-color-style':
      return 'text-blue-600';
    case 'kw-meta-interest':
      return 'text-amber-600';
    default:
      return 'text-[#3a3a3c]';
  }
}

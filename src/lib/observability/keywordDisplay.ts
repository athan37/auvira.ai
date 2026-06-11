import { isIntentProfileHighlightKeyword } from './parseIntentProfile';

export interface KeywordDisplayMeta {
  raw: string;
  display: string;
  rank: number;
  highlight: boolean;
  isGradient: boolean;
}

/** Capitalize keyword for display while keeping raw token for logic. */
export function capitalizeKeywordDisplay(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('gradient-')) {
    const color = trimmed.slice('gradient-'.length);
    return `Gradient ${color.charAt(0).toUpperCase()}${color.slice(1)}`;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Whether a keyword token signals color/style interest. */
export function isGradientStyleKeyword(keyword: string): boolean {
  return keyword.trim().toLowerCase().startsWith('gradient-');
}

/**
 * Build display metadata for intent profile keywords (rank = array index).
 * Earlier keywords receive larger chip sizing in the UI.
 */
export function buildKeywordDisplayMeta(keywords: string[]): KeywordDisplayMeta[] {
  return keywords.map((raw, rank) => {
    const highlight =
      isIntentProfileHighlightKeyword(raw) || isGradientStyleKeyword(raw);
    return {
      raw,
      display: capitalizeKeywordDisplay(raw),
      rank,
      highlight,
      isGradient: isGradientStyleKeyword(raw),
    };
  });
}

/** Tailwind text size class from keyword rank (0 = highest weight). */
export function keywordRankTextClass(rank: number): string {
  if (rank <= 1) return 'text-sm';
  if (rank <= 4) return 'text-xs';
  return 'text-[11px]';
}

/** Tailwind padding class from keyword rank. */
export function keywordRankPaddingClass(rank: number): string {
  if (rank <= 1) return 'px-3 py-1.5';
  if (rank <= 4) return 'px-2.5 py-1';
  return 'px-2 py-0.5';
}

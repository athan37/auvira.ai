import {
  extractFindReplacePair,
  stripPinnedTargetSuffix,
} from './configTextEditUtils';
import type { SectionElementSurface } from './sectionElementRegistry';

const MIN_SCORE = 12;
const MIN_MARGIN = 8;
const VISIBLE_TEXT_BOOST = 35;
const ALIAS_BOOST = 40;
const LABEL_BOOST = 25;
const KIND_BOOST = 45;
const ORDINAL_BOOST = 30;

const ORDINALS: Array<{ pattern: RegExp; index: number }> = [
  { pattern: /\bfirst\b|\b1st\b/i, index: 0 },
  { pattern: /\bsecond\b|\b2nd\b/i, index: 1 },
  { pattern: /\bthird\b|\b3rd\b/i, index: 2 },
  { pattern: /\bfourth\b|\b4th\b/i, index: 3 },
  { pattern: /\bfifth\b|\b5th\b/i, index: 4 },
];

export interface TargetPhraseExtract {
  targetPhrase: string;
  value: string;
}

export interface ElementPhraseApply {
  kind: 'apply';
  fieldPath: string;
  value: string;
  surface: SectionElementSurface;
  reason: string;
}

export interface ElementPhraseClarify {
  kind: 'clarify';
  candidates: SectionElementSurface[];
  value: string;
}

export type ElementPhraseMatchResult =
  | ElementPhraseApply
  | ElementPhraseClarify
  | { kind: 'none' };

/** Remove one pair of surrounding ASCII quotes from a parsed replacement value. */
function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Parse copy intent into an explicit target element phrase and replacement value.
 */
export function extractTargetPhrase(message: string): TargetPhraseExtract | null {
  const normalized = stripPinnedTargetSuffix(message);
  if (extractFindReplacePair(message)) return null;

  const quotedBoth = normalized.match(
    /\b(?:change|update|set|make|edit)\s+(?:the\s+)?["']([^"']+)["']\s+to\s+["']([^"']+)["']\s*$/i
  );
  if (quotedBoth?.[1] && quotedBoth[2]) {
    return { targetPhrase: quotedBoth[1].trim(), value: quotedBoth[2].trim() };
  }

  const unquoted = normalized.match(
    /\b(?:change|update|set|make|edit)\s+(?:the\s+)?(.+?)\s+to\s+(.+?)\s*$/i
  );
  if (!unquoted?.[1] || !unquoted[2]) return null;

  const targetPhrase = unquoted[1].trim();
  const value = stripWrappingQuotes(unquoted[2]);

  if (/^(?:title|headline|subheadline|tagline)$/i.test(targetPhrase)) return null;
  if (targetPhrase.length < 2 || value.length < 1) return null;

  return { targetPhrase, value };
}

function phraseTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreElementSurface(
  surface: SectionElementSurface,
  targetPhrase: string,
  fullMessage: string
): number {
  let score = 0;
  const phraseLower = targetPhrase.toLowerCase();
  const tokens = phraseTokens(targetPhrase);
  const msgLower = fullMessage.toLowerCase();

  const visibleLower = (surface.visibleText ?? '').toLowerCase();
  const labelLower = surface.humanLabel.toLowerCase();
  const aliases = surface.matchAliases ?? [];

  if (visibleLower && phraseLower.includes(visibleLower)) score += VISIBLE_TEXT_BOOST + 20;
  if (visibleLower) {
    for (const token of tokens) {
      if (visibleLower.includes(token)) score += VISIBLE_TEXT_BOOST;
    }
  }

  for (const token of tokens) {
    if (labelLower.includes(token)) score += LABEL_BOOST;
    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower.includes(token) || phraseLower.includes(aliasLower)) {
        score += ALIAS_BOOST;
      }
    }
  }

  if (/\b(btn|button|cta)\b/i.test(phraseLower) && surface.elementKind === 'button') {
    score += KIND_BOOST;
  }

  if (/\bphone\b/i.test(phraseLower)) {
    if (surface.elementKind === 'contact_field' || surface.fieldPath === 'contact.phone') {
      score += KIND_BOOST;
    }
    if (/\b(card|inner|panel)\b/i.test(phraseLower) && surface.placement === 'inner_card') {
      score += KIND_BOOST;
    }
    if (/\b(button|call|link)\b/i.test(phraseLower) && surface.placement === 'left_column') {
      score += KIND_BOOST;
    }
  }

  if (/\bemail\b/i.test(phraseLower) && surface.fieldPath === 'contact.email') {
    score += KIND_BOOST;
  }

  if (/\b(card|title|heading)\b/i.test(phraseLower) && surface.elementKind === 'heading') {
    score += 20;
  }

  if (/\b(card|item|service)\b/i.test(phraseLower) && surface.elementKind === 'item_title') {
    score += KIND_BOOST;
  }

  if (/\btitle\b/i.test(phraseLower) && surface.elementKind === 'item_title') {
    score += 25;
  }

  if (/\bdescription\b/i.test(phraseLower) && surface.elementKind === 'item_body') {
    score += 25;
  }

  for (const { pattern, index } of ORDINALS) {
    if (pattern.test(phraseLower) && surface.itemIndex === index) {
      score += ORDINAL_BOOST;
    }
  }

  if (/\bcontact\s+information\b|\bcontact\s+info\b/i.test(phraseLower)) {
    if (surface.fieldPath.endsWith('.subtitle')) score += KIND_BOOST;
  }

  if (/\binner\s+card\b|\bcard\s+title\b/i.test(phraseLower) && surface.fieldPath.endsWith('.subtitle')) {
    score += KIND_BOOST;
  }

  if (
    (/\bcontact\s+information\b|\bcontact\s+info\b|\bcard\s+title\b/i.test(phraseLower) ||
      /\bcontact\s+information\b|\bcontact\s+info\b/i.test(msgLower)) &&
    /sections\[\d+\]\.title$/.test(surface.fieldPath)
  ) {
    score -= KIND_BOOST + 20;
  }

  if (msgLower.includes(phraseLower) && visibleLower && phraseLower.includes(visibleLower)) {
    score += 15;
  }

  return score;
}

/**
 * Score target phrase against section element catalog surfaces.
 */
export function matchSectionElementPhrase(
  targetPhrase: string,
  catalog: SectionElementSurface[],
  fullMessage: string,
  value: string
): ElementPhraseMatchResult {
  const copySurfaces = catalog.filter((s) => s.editFamily === 'copy');
  if (copySurfaces.length === 0) return { kind: 'none' };

  const scored = copySurfaces
    .map((surface) => ({
      surface,
      score: scoreElementSurface(surface, targetPhrase, fullMessage),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: 'none' };

  const top = scored[0]!;
  const second = scored[1];

  if (top.score < MIN_SCORE) return { kind: 'none' };

  if (second && top.score - second.score < MIN_MARGIN) {
    const tied = scored.filter((s) => top.score - s.score < MIN_MARGIN).map((s) => s.surface);
    return { kind: 'clarify', candidates: tied.slice(0, 5), value };
  }

  return {
    kind: 'apply',
    fieldPath: top.surface.fieldPath,
    value,
    surface: top.surface,
    reason: `Element phrase match (score ${top.score}): "${targetPhrase}" → ${top.surface.humanLabel}`,
  };
}

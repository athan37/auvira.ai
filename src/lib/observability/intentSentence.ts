import type { ImplicitReferenceKind } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';

const COLOR_WORDS =
  /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|navy|teal|cyan|amber|indigo|violet|brown|beige|gold|silver)\b/gi;

const GRADIENT_CLASS_PATTERN = /gradient-([a-z]+)/gi;
const GRADIENT_PHRASE_PATTERN = /gradient\s+([a-z]+)/gi;

function findColorsInText(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(COLOR_WORDS)) {
    if (match[0]) found.push(match[0].toLowerCase());
  }
  for (const match of text.matchAll(GRADIENT_CLASS_PATTERN)) {
    if (match[1]) found.push(match[1].toLowerCase());
  }
  for (const match of text.matchAll(GRADIENT_PHRASE_PATTERN)) {
    if (match[1]) found.push(match[1].toLowerCase());
  }
  return [...new Set(found)];
}

const UNRESOLVED_INTENT_PATTERN =
  /\b(?:not yet known|not known from|color not yet|could not resolve|still ambiguous)\b/i;

/** True when Monitor intent sentence signals missing value (still needs clarification). */
export function intentSentenceIsUnresolved(sentence: string): boolean {
  return UNRESOLVED_INTENT_PATTERN.test(sentence);
}

/** Extract all color tokens from a Monitor intent sentence. */
export function extractColorsFromIntentSentence(sentence: string): string[] {
  if (intentSentenceIsUnresolved(sentence)) return [];
  return findColorsInText(sentence);
}

/** Extract a concrete color from a Monitor intent sentence. */
export function extractColorFromIntentSentence(sentence: string): string | null {
  const colors = extractColorsFromIntentSentence(sentence);
  if (colors.length === 0) return null;
  return colors[colors.length - 1] ?? null;
}

/** Extract quoted copy/CTA value from a Monitor intent sentence. */
export function extractQuotedValueFromIntentSentence(sentence: string): string | null {
  if (intentSentenceIsUnresolved(sentence)) return null;
  const match = sentence.match(/to\s+["']([^"']{2,120})["']/i);
  return match?.[1]?.trim() ?? null;
}

/** Whether Monitor provided a usable resolved intent sentence for this edit. */
export function hasUsableIntentSentence(sentence?: string | null): boolean {
  return Boolean(sentence?.trim() && !intentSentenceIsUnresolved(sentence));
}

export interface IntentSentenceEvidence {
  value: string;
  reason: string;
}

/** Map Monitor intent sentence to implicit-reference evidence for a phrase kind. */
export function evidenceFromIntentSentence(
  sentence: string,
  kind: ImplicitReferenceKind
): IntentSentenceEvidence | null {
  const trimmed = sentence.trim();
  if (!hasUsableIntentSentence(trimmed)) return null;

  if (kind === 'color') {
    const color = extractColorFromIntentSentence(trimmed);
    if (!color) return null;
    return { value: color, reason: 'Resolved from Monitor intent sentence' };
  }

  if (kind === 'cta' || kind === 'copy') {
    const quoted = extractQuotedValueFromIntentSentence(trimmed);
    if (!quoted) return null;
    return { value: quoted, reason: 'Resolved from Monitor intent sentence' };
  }

  return null;
}

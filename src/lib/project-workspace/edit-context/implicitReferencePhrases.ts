import { extractColorsFromMessage, TAILWIND_COLOR_NAMES } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import type { ImplicitReferenceKind } from './implicitReferenceTypes';

export interface DetectedImplicitPhrase {
  phrase: string;
  kind: ImplicitReferenceKind;
  pattern: RegExp;
}

const IMPLICIT_PHRASE_PATTERNS: Array<{ pattern: RegExp; kind: ImplicitReferenceKind }> = [
  { pattern: /\bmy\s+favorite\s+colou?r\b/i, kind: 'color' },
  { pattern: /\bbrand\s+colou?r\b/i, kind: 'color' },
  { pattern: /\bmatch\s+my\s+brand\b/i, kind: 'color' },
  { pattern: /\bsame\s+as\s+before\b/i, kind: 'unknown' },
  { pattern: /\blike\s+last\s+time\b/i, kind: 'unknown' },
  { pattern: /\bsame\s+(?:style\s+as\s+)?(?:the\s+)?hero\b/i, kind: 'style' },
  { pattern: /\bsame\s+style\s+as\s+the\s+hero\b/i, kind: 'style' },
  { pattern: /\b(?:our\s+)?usual\s+cta\b/i, kind: 'cta' },
  { pattern: /\bour\s+usual\s+button\s+text\b/i, kind: 'cta' },
  { pattern: /\bmain\s+service\b/i, kind: 'offer' },
  { pattern: /\bprimary\s+offer\b/i, kind: 'offer' },
  { pattern: /\bthe\s+first\s+package\b/i, kind: 'offer' },
  { pattern: /\bour\s+most\s+common\s+edit\b/i, kind: 'unknown' },
];

/** Detect implicit reference phrases in the owner message. */
export function detectImplicitPhrases(message: string): DetectedImplicitPhrase[] {
  const found: DetectedImplicitPhrase[] = [];
  for (const { pattern, kind } of IMPLICIT_PHRASE_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[0]) {
      found.push({ phrase: match[0], kind, pattern });
    }
  }
  return found;
}

const COLOR_NAME_SET = new Set<string>(TAILWIND_COLOR_NAMES);

/** Extract explicit color/value stated in the message (wins over context). */
export function extractExplicitColorValue(message: string): string | null {
  const hex = message.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/);
  if (hex?.[0]) return hex[0];

  const colors = extractColorsFromMessage(message);
  if (colors.length > 0) return colors[0]!;

  const toColor = message.match(
    /\b(?:to|as|into)\s+(?:a\s+)?([a-z]+)\b/i
  );
  if (toColor?.[1] && COLOR_NAME_SET.has(toColor[1].toLowerCase() as (typeof TAILWIND_COLOR_NAMES)[number])) {
    return toColor[1].toLowerCase();
  }

  return null;
}

/** Extract explicit quoted copy/value from the message. */
export function extractExplicitQuotedValue(message: string): string | null {
  const quoted = message.match(/["']([^"']{1,120})["']/);
  return quoted?.[1]?.trim() ?? null;
}

/** True when the message states a concrete value for the given kind. */
export function hasExplicitValueForKind(message: string, kind: ImplicitReferenceKind): boolean {
  if (kind === 'color') return extractExplicitColorValue(message) != null;
  if (kind === 'copy' || kind === 'cta') return extractExplicitQuotedValue(message) != null;
  if (kind === 'style') {
    return /\b(?:gradient|bg-|backgroundClass|presentation)\b/i.test(message);
  }
  return false;
}

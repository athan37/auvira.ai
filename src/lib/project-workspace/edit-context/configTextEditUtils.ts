const PINNED_TARGET_SUFFIX = /\s*\(UI-selected section:[^)]*\)\s*$/i;

/** Remove UI pin hint appended to effectiveMessage during edit context build. */
export function stripPinnedTargetSuffix(message: string): string {
  return message.replace(PINNED_TARGET_SUFFIX, '').trim();
}

/** Extract replacement text from quoted or unquoted "… to …" copy edits. */
export function extractReplacementValue(message: string): string | null {
  const normalized = stripPinnedTargetSuffix(message);
  const quoted = normalized.match(/\bto\s+["']([^"']+)["']/i);
  if (quoted?.[1]) return quoted[1].trim();

  const changeTitle = normalized.match(
    /\b(?:change|update|set|make)\s+(?:the\s+)?(?:title|headline)\s+(?:to\s+)?["']?([^"'.]+?)["']?\s*$/i
  );
  if (changeTitle?.[1]) return changeTitle[1].trim();

  const unquoted = normalized.match(/\b(?:change|update|set|make|edit)\s+.+\s+to\s+(.+?)\s*$/i);
  if (unquoted?.[1]) {
    const value = unquoted[1].trim();
    if (value.length >= 2) return value;
  }

  return null;
}

/**
 * When a preview target is pinned, treat a short plain message as the new copy value
 * (e.g. "We'd love to hear from you" with no "change … to …" phrasing).
 */
export function extractBareCopyValue(message: string, hasPinnedTarget: boolean): string | null {
  if (!hasPinnedTarget) return null;
  if (extractReplacementValue(message) || extractFindReplacePair(message)) return null;

  const normalized = stripPinnedTargetSuffix(message).trim();
  if (!normalized || normalized.length > 200) return null;
  if (/^(change|update|set|make|edit|remove|delete|add)\b/i.test(normalized)) return null;
  if (/^(please|can you|could you)\b/i.test(normalized)) return null;
  if (/\b(duplicate|clone|reorder)\b/i.test(normalized)) return null;
  if (/\b(delete|remove)\s+(?:this\s+)?(?:card|item|row)\b/i.test(normalized)) return null;

  return normalized;
}

/** Parse `"old" to "new"` find/replace pair from message. */
export function extractFindReplacePair(message: string): { find: string; replace: string } | null {
  const normalized = stripPinnedTargetSuffix(message);
  const match = normalized.match(/["']([^"']+)["']\s+to\s+["']([^"']+)["']/i);
  if (!match?.[1] || !match[2]) return null;
  return { find: match[1].trim(), replace: match[2].trim() };
}

/** Extract phone digits from "add/set phone number …" without "change … to …" phrasing. */
export function extractTypedPhoneValue(message: string): string | null {
  const normalized = stripPinnedTargetSuffix(message);
  if (!/\bphone\b|\bnumber\b/i.test(normalized)) return null;
  const phone = normalized.match(
    /\b(?:phone|number)\b[^0-9(+]*([(+][\d\s().-]{7,}|\d[\d\s().-]{6,})/i
  );
  return phone?.[1]?.trim() ?? null;
}

/** True when the owner explicitly names a global contact field in the message. */
export function messageExplicitlyRequestsContactField(
  message: string,
  fieldPath: string
): boolean {
  const normalized = stripPinnedTargetSuffix(message);
  if (fieldPath === 'contact.phone') return /\bphone\b|\bnumber\b/i.test(normalized);
  if (fieldPath === 'contact.email') return /\bemail\b/i.test(normalized);
  if (fieldPath === 'contact.address') return /\baddress\b/i.test(normalized);
  return false;
}

/** Tokenize message for label overlap scoring. */
export function messageTokens(message: string): string[] {
  const normalized = stripPinnedTargetSuffix(message).toLowerCase();
  return normalized
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'the',
  'this',
  'that',
  'change',
  'update',
  'edit',
  'make',
  'set',
  'section',
  'please',
  'want',
]);

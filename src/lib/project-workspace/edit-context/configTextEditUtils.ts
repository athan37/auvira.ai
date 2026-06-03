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

/** Parse `"old" to "new"` find/replace pair from message. */
export function extractFindReplacePair(message: string): { find: string; replace: string } | null {
  const normalized = stripPinnedTargetSuffix(message);
  const match = normalized.match(/["']([^"']+)["']\s+to\s+["']([^"']+)["']/i);
  if (!match?.[1] || !match[2]) return null;
  return { find: match[1].trim(), replace: match[2].trim() };
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

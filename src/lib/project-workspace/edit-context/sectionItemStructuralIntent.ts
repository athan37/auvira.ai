export type SectionItemStructuralOperation = 'add' | 'duplicate' | 'remove' | 'update';

export interface SectionItemStructuralIntent {
  operation: SectionItemStructuralOperation;
  /** Clone shape from pinned item (requires item pin). */
  cloneFromPinned: boolean;
  /** Requires a pinned item index (duplicate, remove, like-this add). */
  requiresItemPin: boolean;
  title?: string;
  description?: string;
}

function extractQuotedValue(message: string): string | null {
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  return null;
}

function extractWithTitleValue(message: string): string | null {
  const withTitle = message.match(/\bwith\s+title\s+(.+?)(?:\.|$)/i);
  if (withTitle?.[1]?.trim()) {
    return withTitle[1].replace(/^["']|["']$/g, '').trim();
  }
  return null;
}

function extractTitledCardValue(message: string): string | null {
  const titled = message.match(
    /\badd(?:\s+a|\s+an|\s+another|\s+one\s+more)?\s+(?:\w+\s+){0,3}card(?:s)?\s+titled\s+(.+?)(?:\.|$)/i
  );
  if (titled?.[1]?.trim()) {
    return titled[1].replace(/^["']|["']$/g, '').trim();
  }
  return extractQuotedValue(message);
}

/** True when the message is a structural card/item mutation (not copy-only). */
export function isSectionItemStructuralRequest(message: string): boolean {
  return parseSectionItemStructuralIntent(message) != null;
}

/**
 * Parse deterministic structural intent for generic sections[i].items[] edits.
 */
export function parseSectionItemStructuralIntent(
  message: string
): SectionItemStructuralIntent | null {
  const lower = message.toLowerCase().trim();
  if (!lower) return null;

  if (
    /\bduplicate\b/.test(lower) &&
    (/\bthis\b/.test(lower) || /\bcard\b/.test(lower) || /\bitem\b/.test(lower))
  ) {
    return {
      operation: 'duplicate',
      cloneFromPinned: true,
      requiresItemPin: true,
    };
  }

  if (
    (/\bdelete\b/.test(lower) || /\bremove\b/.test(lower)) &&
    (/\bthis\b/.test(lower) || /\bcard\b/.test(lower) || /\bitem\b/.test(lower))
  ) {
    return {
      operation: 'remove',
      cloneFromPinned: false,
      requiresItemPin: true,
    };
  }

  if (
    /\badd\b/.test(lower) &&
    (/\blike\s+this\b/.test(lower) || /\b(one\s+more|another)\b/.test(lower)) &&
    (/\bthis\b/.test(lower) || /\bcard\b/.test(lower) || /\bitem\b/.test(lower))
  ) {
    const title = extractWithTitleValue(message) ?? extractQuotedValue(message) ?? undefined;
    return {
      operation: 'add',
      cloneFromPinned: true,
      requiresItemPin: true,
      title,
    };
  }

  if (/\badd\b/.test(lower) && /\bcard\b/.test(lower) && /\btitled\b/.test(lower)) {
    const title = extractTitledCardValue(message);
    if (!title) return null;
    return {
      operation: 'add',
      cloneFromPinned: false,
      requiresItemPin: false,
      title,
    };
  }

  return null;
}

/** Parsed Site Monitor GET /projects/{id}/intent profile (project-level extracted attributes). */

export interface MonitorIntentProfileView {
  keywords: string[];
  intents: string[];
  turnCount: number;
  updatedAt?: string;
  scope?: string;
}

/** Parse Monitor intent profile response. */
export function parseIntentProfileResponse(
  raw: Record<string, unknown> | null | undefined
): MonitorIntentProfileView | null {
  const intent = raw?.intent;
  if (!intent || typeof intent !== 'object') return null;

  const profile = intent as Record<string, unknown>;
  const keywords = Array.isArray(profile.keywords)
    ? profile.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];
  const intents = Array.isArray(profile.intents)
    ? profile.intents.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];

  return {
    keywords,
    intents,
    turnCount: typeof profile.turn_count === 'number' ? profile.turn_count : 0,
    updatedAt: typeof profile.updated_at === 'string' ? profile.updated_at : undefined,
    scope: typeof profile.scope === 'string' ? profile.scope : undefined,
  };
}

/** Highlight keywords useful for demo (favorite color tracking). */
export function isIntentProfileHighlightKeyword(keyword: string): boolean {
  const lower = keyword.trim().toLowerCase();
  return (
    lower === 'favorite' ||
    lower === 'favourite' ||
    lower === 'color' ||
    lower === 'colour' ||
    lower.includes('favorite') ||
    lower.includes('colour')
  );
}

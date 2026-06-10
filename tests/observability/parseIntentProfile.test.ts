import { describe, expect, it } from 'vitest';
import {
  isIntentProfileHighlightKeyword,
  parseIntentProfileResponse,
} from '@/lib/observability/parseIntentProfile';

describe('parseIntentProfileResponse', () => {
  it('parses keywords and intents from monitor profile', () => {
    const profile = parseIntentProfileResponse({
      intent: {
        keywords: ['favorite', 'color', 'hero'],
        intents: ['style_background'],
        turn_count: 49,
        scope: 'project',
        updated_at: '2026-06-09T10:00:00Z',
      },
    });

    expect(profile).toEqual({
      keywords: ['favorite', 'color', 'hero'],
      intents: ['style_background'],
      turnCount: 49,
      scope: 'project',
      updatedAt: '2026-06-09T10:00:00Z',
    });
  });

  it('returns null when intent block is missing', () => {
    expect(parseIntentProfileResponse({})).toBeNull();
  });
});

describe('isIntentProfileHighlightKeyword', () => {
  it('highlights favorite and color keywords', () => {
    expect(isIntentProfileHighlightKeyword('favorite')).toBe(true);
    expect(isIntentProfileHighlightKeyword('color')).toBe(true);
    expect(isIntentProfileHighlightKeyword('hero')).toBe(false);
  });
});

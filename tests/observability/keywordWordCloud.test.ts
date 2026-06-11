import { describe, expect, it } from 'vitest';
import {
  buildKeywordWordCloudItems,
  keywordWordCloudFontSizeRem,
  kwClass,
  renderIntentProfile,
} from '@/lib/observability/keywordWordCloud';

describe('keywordWordCloud', () => {
  it('assigns larger rem size to higher-ranked keywords', () => {
    expect(keywordWordCloudFontSizeRem(0, 5)).toBeGreaterThan(keywordWordCloudFontSizeRem(4, 5));
    expect(keywordWordCloudFontSizeRem(0, 1)).toBe(2.1);
    expect(keywordWordCloudFontSizeRem(4, 5)).toBeCloseTo(0.7, 5);
  });

  it('classifies keywords into interest classes', () => {
    expect(kwClass('favorite')).toBe('kw-meta-interest');
    expect(kwClass('color')).toBe('kw-meta-interest');
    expect(kwClass('gradient-red')).toBe('kw-color-style');
    expect(kwClass('blue')).toBe('kw-color-style');
    expect(kwClass('hero')).toBe('kw-general');
  });

  it('builds cloud items with display labels from array order', () => {
    const items = buildKeywordWordCloudItems(['favorite', 'gradient-red', 'hero']);
    expect(items).toHaveLength(3);
    expect(items[0]?.display).toBe('Favorite');
    expect(items[0]?.fontSizeRem).toBeGreaterThan(items[2]?.fontSizeRem ?? 0);
    expect(items[0]?.interestClass).toBe('kw-meta-interest');
    expect(items[1]?.interestClass).toBe('kw-color-style');
  });

  it('renderIntentProfile maps meta, cloud, and classified intents', () => {
    const model = renderIntentProfile({
      keywords: ['favorite', 'hero'],
      intents: ['copy_edit'],
      turnCount: 12,
      scope: 'project',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(model?.turnCount).toBe(12);
    expect(model?.scope).toBe('project');
    expect(model?.cloudItems).toHaveLength(2);
    expect(model?.intents).toEqual(['copy_edit']);
  });
});

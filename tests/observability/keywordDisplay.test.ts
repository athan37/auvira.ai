import { describe, expect, it } from 'vitest';
import {
  buildKeywordDisplayMeta,
  capitalizeKeywordDisplay,
  isGradientStyleKeyword,
  keywordRankTextClass,
} from '@/lib/observability/keywordDisplay';

describe('keywordDisplay', () => {
  it('capitalizes and highlights gradient and favorite keywords', () => {
    expect(capitalizeKeywordDisplay('gradient-red')).toBe('Gradient Red');
    expect(isGradientStyleKeyword('gradient-blue')).toBe(true);

    const meta = buildKeywordDisplayMeta(['favorite', 'gradient-red', 'hero']);
    expect(meta[0]?.highlight).toBe(true);
    expect(meta[1]?.highlight).toBe(true);
    expect(meta[1]?.isGradient).toBe(true);
    expect(meta[2]?.highlight).toBe(false);
  });

  it('assigns larger text class to higher-ranked keywords', () => {
    expect(keywordRankTextClass(0)).toBe('text-sm');
    expect(keywordRankTextClass(5)).toBe('text-[11px]');
  });
});

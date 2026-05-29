import { describe, it, expect } from 'vitest';
import { repairUnescapedJsxQuoteEntities } from '@/lib/project-workspace/repairPageTsxStructure';

describe('repairUnescapedJsxQuoteEntities', () => {
  it('escapes testimonial quote pattern for react/no-unescaped-entities', () => {
    const before =
      '<p className="text-slate-600 italic">"{item.description || "Great service!"}"</p>';
    const { content, repaired } = repairUnescapedJsxQuoteEntities(before);
    expect(repaired).toBe(true);
    expect(content).toContain('&ldquo;');
    expect(content).toContain('&rdquo;');
    expect(content).toContain("'Great service!'");
    expect(content).not.toContain('"{item');
  });
});

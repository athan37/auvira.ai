import { describe, it, expect } from 'vitest';
import { extractCssColor, normalizeSiteSpecColors, pickBackgroundColor } from '../src/lib/builder/cssColor';
import { normalizeSiteSpec } from '../src/lib/builder/normalizeSiteSpec';
import type { SiteSpec } from '../src/lib/agent/schemas';

describe('extractCssColor', () => {
  it('extracts hex from prose', () => {
    expect(extractCssColor('Bright Red (#FF0000) - Full page background')).toBe('#FF0000');
  });

  it('normalizes 3-digit hex', () => {
    expect(extractCssColor('#f00')).toBe('#FF0000');
  });

  it('parses rgb()', () => {
    expect(extractCssColor('rgb(255, 0, 0)')).toBe('#FF0000');
  });

  it('returns null for invalid input', () => {
    expect(extractCssColor('Bright Red')).toBeNull();
  });
});

describe('normalizeSiteSpecColors', () => {
  it('dedupes and filters invalid entries', () => {
    expect(
      normalizeSiteSpecColors(['#FF0000', 'Bright Red (#FF0000)', 'not a color'])
    ).toEqual(['#FF0000']);
  });
});

describe('pickBackgroundColor', () => {
  it('uses first valid color', () => {
    expect(pickBackgroundColor(['Bright Red (#FF0000)'], '#FFFFFF')).toBe('#FF0000');
  });
});

describe('normalizeSiteSpec', () => {
  it('syncs hero title with siteTitle', () => {
    const spec: SiteSpec = {
      siteTitle: 'Old Title',
      tagline: 'Tag',
      primaryCTA: 'Call',
      secondaryCTA: 'Learn',
      sections: [
        { type: 'hero', title: 'NEW HEADLINE', body: 'Sub copy', items: [] },
        { type: 'services', title: 'Services', body: '', items: ['A'] },
        { type: 'about', title: 'About', body: '', items: [] },
        { type: 'contact', title: 'Contact', body: '', items: [] },
      ],
      designDirection: {
        tone: 'bold',
        layout: 'modern',
        colors: ['Bright Red (#FF0000)'],
      },
    };
    const out = normalizeSiteSpec(spec);
    expect(out.siteTitle).toBe('NEW HEADLINE');
    expect(out.designDirection?.colors).toEqual(['#FF0000']);
    expect(out.sections.find((s) => s.type === 'hero')?.title).toBe('NEW HEADLINE');
  });
});

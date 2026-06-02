import { describe, expect, it } from 'vitest';
import { PAGE_TSX_TEMPLATE } from '@/lib/builder/pageTemplate';

describe('pageTemplate testimonials', () => {
  it('uses HTML entities instead of raw JSX quote characters', () => {
    expect(PAGE_TSX_TEMPLATE).toContain('&ldquo;{item.description || \'Great service!\'}&rdquo;');
    expect(PAGE_TSX_TEMPLATE).not.toMatch(/italic">"\{item\.description/);
  });
});

describe('pageTemplate hero variants', () => {
  it('switches hero layout via preset.heroStyle', () => {
    expect(PAGE_TSX_TEMPLATE).toContain('const style = preset.heroStyle || "split"');
    expect(PAGE_TSX_TEMPLATE).toContain('function HeroCentered()');
    expect(PAGE_TSX_TEMPLATE).toContain('function HeroPhoneFirst()');
    expect(PAGE_TSX_TEMPLATE).toContain('function HeroMenuFeature()');
    expect(PAGE_TSX_TEMPLATE).toContain('function HeroAppointment()');
  });
});

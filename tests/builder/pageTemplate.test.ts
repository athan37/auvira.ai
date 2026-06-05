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

  it('tags hero Get Started card phone and email rows for preview drag', () => {
    expect(PAGE_TSX_TEMPLATE).toContain('contact-phone-hero-card');
    expect(PAGE_TSX_TEMPLATE).toContain('contact-email-hero-card');
    expect(PAGE_TSX_TEMPLATE).toContain('fieldPath: "contact.phone"');
    expect(PAGE_TSX_TEMPLATE).toContain('fieldPath: "contact.email"');
  });

  it('renders contact.extraLines rows in hero and contact cards', () => {
    expect(PAGE_TSX_TEMPLATE).toContain('siteConfig.contact.extraLines');
    expect(PAGE_TSX_TEMPLATE).toContain('contact.extraLines[" + extraIndex + "]');
    expect(PAGE_TSX_TEMPLATE).toContain('contact.address');
  });
});

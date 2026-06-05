import { describe, expect, it } from 'vitest';
import {
  buildUniversalBootstrapBridgeScript,
  inferContactFieldPathFromText,
  inferElementKindFromTag,
  isMeaningfulLeafTag,
  mapCtaFieldPath,
} from '@/lib/preview/bootstrapPreviewElements';

describe('mapCtaFieldPath', () => {
  it('maps nav and hero primary CTAs to hero.primaryCta', () => {
    expect(mapCtaFieldPath({ analyticsId: 'cta_nav_primary' })).toBe('hero.primaryCta');
    expect(mapCtaFieldPath({ analyticsId: 'cta_hero_primary' })).toBe('hero.primaryCta');
    expect(mapCtaFieldPath({ href: '#contact', analyticsType: 'cta' })).toBe('hero.primaryCta');
  });

  it('maps contact section CTA without primaryButton class requirement', () => {
    expect(mapCtaFieldPath({ analyticsId: 'cta_contact_primary' })).toBe('hero.primaryCta');
    expect(mapCtaFieldPath({ href: '#contact' })).toBe('hero.primaryCta');
  });

  it('maps tel and mailto links', () => {
    expect(mapCtaFieldPath({ href: 'tel:+15551234567' })).toBe('contact.phone');
    expect(mapCtaFieldPath({ href: 'mailto:hello@example.com' })).toBe('contact.email');
  });

  it('maps hero secondary CTA', () => {
    expect(mapCtaFieldPath({ analyticsId: 'cta_hero_secondary' })).toBe('hero.secondaryCta');
  });
});

describe('isMeaningfulLeafTag', () => {
  it('recognizes interactive and text leaf tags', () => {
    expect(isMeaningfulLeafTag('a')).toBe(true);
    expect(isMeaningfulLeafTag('BUTTON')).toBe(true);
    expect(isMeaningfulLeafTag('h2')).toBe(true);
    expect(isMeaningfulLeafTag('p')).toBe(true);
    expect(isMeaningfulLeafTag('div')).toBe(false);
  });
});

describe('inferElementKindFromTag', () => {
  it('classifies tags for inference', () => {
    expect(inferElementKindFromTag('A', '#contact')).toBe('button');
    expect(inferElementKindFromTag('A', 'tel:555')).toBe('contact_field');
    expect(inferElementKindFromTag('H2')).toBe('heading');
    expect(inferElementKindFromTag('P')).toBe('body');
  });
});

describe('inferContactFieldPathFromText', () => {
  it('maps placeholder phone copy without digits to contact.phone', () => {
    expect(inferContactFieldPathFromText('Display phone number provided by user')).toBe(
      'contact.phone'
    );
  });

  it('maps email rows to contact.email', () => {
    expect(inferContactFieldPathFromText('1234@asdfasd.edu')).toBe('contact.email');
  });
});

describe('buildUniversalBootstrapBridgeScript', () => {
  it('includes universal bootstrap and draggable root helpers', () => {
    const script = buildUniversalBootstrapBridgeScript();
    expect(script).toContain('function findDraggableRoot');
    expect(script).toContain('function inferLeafTarget');
    expect(script).toContain('function bootstrapUniversalElements');
    expect(script).toContain('function bootstrapNavElements');
    expect(script).toContain('function bootstrapHeroContactFields');
    expect(script).toContain('function bootstrapContactValueRows');
    expect(script).toContain('contact.extraLines[');
    expect(script).not.toContain('primaryButton');
  });
});

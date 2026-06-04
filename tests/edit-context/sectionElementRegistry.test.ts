import { describe, expect, it } from 'vitest';
import { buildSectionElementCatalog } from '@/lib/project-workspace/edit-context/sectionElementRegistry';

const CONTACT_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '', primaryCta: 'Get in Touch', secondaryCta: 'Learn More' },
  contact: { phone: '555-0100', email: 'hello@demo.test' },
  sections: [
    {
      type: 'contact',
      title: 'Get Started Today',
      body: 'Reach out anytime.',
      subtitle: '',
      analyticsId: 'contact-1',
    },
  ],
};`;

const SERVICES_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '' },
  contact: {},
  sections: [
    {
      type: 'services',
      title: 'Our Services',
      body: 'What we offer.',
      items: [
        { title: 'Drain Cleaning', description: 'Fast drain service' },
        { title: 'Water Heaters', description: 'Repair and install' },
      ],
    },
  ],
};`;

describe('buildSectionElementCatalog', () => {
  it('includes embedded primary CTA button for contact sections', () => {
    const catalog = buildSectionElementCatalog(CONTACT_CONFIG, 0);
    const primaryBtn = catalog.find((s) => s.fieldPath === 'hero.primaryCta');
    expect(primaryBtn).toBeDefined();
    expect(primaryBtn?.elementKind).toBe('button');
    expect(primaryBtn?.visibleText).toBe('Get in Touch');
    expect(primaryBtn?.source).toBe('embedded_global');
  });

  it('includes phone button and inner-card phone surfaces', () => {
    const catalog = buildSectionElementCatalog(CONTACT_CONFIG, 0);
    const phoneSurfaces = catalog.filter((s) => s.fieldPath === 'contact.phone');
    expect(phoneSurfaces.length).toBeGreaterThanOrEqual(2);
    expect(phoneSurfaces.some((s) => s.placement === 'left_column')).toBe(true);
    expect(phoneSurfaces.some((s) => s.placement === 'inner_card')).toBe(true);
  });

  it('expands service item card surfaces with ordinals', () => {
    const catalog = buildSectionElementCatalog(SERVICES_CONFIG, 0);
    expect(catalog.some((s) => s.fieldPath === 'sections[0].items[0].title')).toBe(true);
    expect(catalog.some((s) => s.fieldPath === 'sections[0].items[1].title')).toBe(true);
    const first = catalog.find((s) => s.fieldPath === 'sections[0].items[0].title');
    expect(first?.matchAliases?.some((a) => a.includes('first'))).toBe(true);
  });

  it('lists hero surfaces when hero is pinned', () => {
    const catalog = buildSectionElementCatalog(CONTACT_CONFIG, 0, {
      selectedTarget: { kind: 'hero', sectionType: 'hero' },
    });
    expect(catalog.some((s) => s.fieldPath === 'hero.headline')).toBe(true);
    expect(catalog.some((s) => s.fieldPath === 'hero.primaryCta')).toBe(true);
  });
});

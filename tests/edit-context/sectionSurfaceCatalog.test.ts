import { describe, expect, it } from 'vitest';
import { buildSectionSurfaceCatalog } from '@/lib/project-workspace/edit-context/sectionSurfaceCatalog';

const CONTACT_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '' },
  contact: { phone: '555', email: 'a@b.co' },
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

describe('buildSectionSurfaceCatalog', () => {
  it('includes inner card heading fallback for contact subtitle', () => {
    const surfaces = buildSectionSurfaceCatalog(CONTACT_CONFIG, 0);
    const subtitle = surfaces.find((s) => s.fieldPath === 'sections[0].subtitle');
    expect(subtitle).toBeDefined();
    expect(subtitle?.humanLabel).toBe('Inner card heading');
    expect(subtitle?.visibleText).toBe('Contact Information');
    expect(subtitle?.source).toBe('renderer_fallback');
  });

  it('includes primary CTA button surface for contact sections', () => {
    const configWithCta = CONTACT_CONFIG.replace(
      "hero: { headline: 'Hero', subheadline: '' }",
      "hero: { headline: 'Hero', subheadline: '', primaryCta: 'Get in Touch' }"
    );
    const surfaces = buildSectionSurfaceCatalog(configWithCta, 0);
    expect(surfaces.some((s) => s.fieldPath === 'hero.primaryCta')).toBe(true);
  });

  it('includes presentation style surfaces', () => {
    const surfaces = buildSectionSurfaceCatalog(CONTACT_CONFIG, 0);
    expect(surfaces.some((s) => s.fieldPath.endsWith('presentation.cardClass'))).toBe(true);
    expect(surfaces.some((s) => s.fieldPath.endsWith('presentation.backgroundClass'))).toBe(true);
  });

  it('boosts pinned fieldPath to front', () => {
    const surfaces = buildSectionSurfaceCatalog(CONTACT_CONFIG, 0, {
      selectedTarget: {
        kind: 'section',
        sectionIndex: 0,
        fieldPath: 'sections[0].body',
        sectionType: 'contact',
      },
    });
    expect(surfaces[0]?.fieldPath).toBe('sections[0].body');
  });
});

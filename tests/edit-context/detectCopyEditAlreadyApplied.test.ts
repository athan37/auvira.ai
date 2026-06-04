import { describe, expect, it } from 'vitest';
import { detectCopyEditAlreadyApplied } from '@/lib/project-workspace/edit-context/detectCopyEditAlreadyApplied';

const SITE_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '', primaryCta: 'hello click on this' },
  contact: { phone: '555', email: 'a@b.test' },
  sections: [
    { type: 'contact', title: 'Get Started Today', body: 'Reach out.', analyticsId: 'contact-1' },
  ],
};`;

describe('detectCopyEditAlreadyApplied', () => {
  it('detects hero.primaryCta already updated for get in touch btn phrase', () => {
    const result = detectCopyEditAlreadyApplied(
      SITE_CONFIG,
      'change get in touch btn to hello click on this',
      {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        sectionId: 'contact-1',
      }
    );
    expect(result.applied).toBe(true);
    expect(result.fieldPath).toBe('hero.primaryCta');
    expect(result.expectedValue).toBe('hello click on this');
  });

  it('returns false when value is not yet applied', () => {
    const pending = SITE_CONFIG.replace('hello click on this', 'Get in Touch');
    const result = detectCopyEditAlreadyApplied(
      pending,
      'change get in touch btn to hello click on this',
      {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        sectionId: 'contact-1',
      }
    );
    expect(result.applied).toBe(false);
  });
});

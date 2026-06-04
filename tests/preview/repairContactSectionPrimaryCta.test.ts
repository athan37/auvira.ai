import { describe, expect, it } from 'vitest';
import { repairContactSectionPrimaryCtaInPage } from '@/lib/preview/repairContactSectionPrimaryCta';

describe('repairContactSectionPrimaryCtaInPage', () => {
  it('replaces hardcoded Get in Touch CTA with hero.primaryCta binding', () => {
    const page = `
      <a href="#contact" className={"btn " + preset.primaryButton}>Get in Touch</a>
    `;
    const { content, repaired } = repairContactSectionPrimaryCtaInPage(page);
    expect(repaired).toBe(true);
    expect(content).toContain('{siteConfig.hero.primaryCta}');
    expect(content).not.toContain('>Get in Touch<');
  });

  it('skips when page already uses hero.primaryCta', () => {
    const page = '<a>{siteConfig.hero.primaryCta}</a>';
    const { repaired } = repairContactSectionPrimaryCtaInPage(page);
    expect(repaired).toBe(false);
  });
});

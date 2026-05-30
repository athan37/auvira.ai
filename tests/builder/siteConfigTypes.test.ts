import { describe, it, expect } from 'vitest';
import {
  ensureSiteConfigTypesSupportGallery,
  ensureSiteConfigTypesSupportPresentation,
  siteConfigNeedsPresentationTypeUpgrade,
  SITE_SECTION_TYPE_UNION,
} from '../../src/lib/builder/siteConfigTypes';
import { repairSiteConfigTypesContent } from '../../src/lib/preview/repairSiteConfigTypes';
import { generateSiteConfig } from '../../src/lib/builder/templates';
import type { SiteSpec } from '../../src/lib/agent/schemas';

const varsityBrokenSiteConfig = `export type SiteSection = {
  id?: string;
  analyticsId?: string;
  type: 'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic' | 'gallery' | 'documentation';
  title: string;
  subtitle?: string;
  body?: string;
  items?: Array<{ title: string; description?: string; imageUrl?: string }>;
  presentation?: SiteSectionPresentation;
};

export type SiteConfig = {
  businessName: string;
  sections: SiteSection[];
};

export const siteConfig: SiteConfig = {
  "sections": [{
    "type": "gallery",
    "title": "Our Products",
    "presentation": { "backgroundClass": "bg-red-500" }
  }]
};`;

const legacySiteConfig = `export type SiteSection = {
  type: 'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic';
  title: string;
  items?: Array<{ title: string; description?: string }>;
};
export const siteConfig: SiteConfig = {
  "sections": [{ "type": "gallery", "title": "Our Products", "items": [{ "title": "A", "imageUrl": "/uploads/a.png" }] }]
};`;

describe('siteConfigTypes', () => {
  it('upgrades legacy SiteSection union to include gallery', () => {
    const out = ensureSiteConfigTypesSupportGallery(legacySiteConfig);
    expect(out).toContain("'gallery'");
    expect(out).toContain('imageUrl?:');
    expect(out).toMatch(/type:\s*'services'/);
    expect(out).not.toMatch(/export type SiteSection = \{\s*\n\s*'services'/);
    expect(SITE_SECTION_TYPE_UNION).toContain('gallery');
  });

  it('upgrades SiteSection union when gallery section exists but type omits gallery', () => {
    const broken = `export type SiteSection = {
  type: 'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic';
  title: string;
};
export const siteConfig: SiteConfig = {
  sections: [{ type: 'gallery', title: 'Products', items: [] }]
};`;
    const out = ensureSiteConfigTypesSupportGallery(broken);
    expect(out).toContain("'gallery'");
    expect(out).toMatch(/type:\s*'services'[^;]*'gallery'/);
  });

  it('generateSiteConfig includes gallery in type union', () => {
    const spec: SiteSpec = {
      siteTitle: 'Test',
      tagline: 'Tag',
      primaryCTA: 'Call',
      secondaryCTA: '',
      sections: [{ type: 'services', title: 'Services', body: '', items: [] }],
      designDirection: { tone: '', layout: '', colors: [] },
    };
    const out = generateSiteConfig(spec);
    expect(out).toContain("'gallery'");
    expect(out).toContain('imageUrl?:');
  });

  it('detects missing SiteSectionPresentation type when SiteSection references it', () => {
    expect(siteConfigNeedsPresentationTypeUpgrade(varsityBrokenSiteConfig)).toBe(true);
  });

  it('inserts SiteSectionPresentation type when section type references it without a definition', () => {
    const out = ensureSiteConfigTypesSupportPresentation(varsityBrokenSiteConfig);
    expect(out).toMatch(/export type SiteSectionPresentation = \{/);
    expect(out.indexOf('export type SiteSectionPresentation = {')).toBeLessThan(
      out.indexOf('export type SiteSection = {')
    );
  });

  it('repairSiteConfigTypesContent fixes presentation-only breakage', () => {
    const { content, repaired } = repairSiteConfigTypesContent(varsityBrokenSiteConfig);
    expect(repaired).toBe(true);
    expect(content).toMatch(/export type SiteSectionPresentation = \{/);
  });
});

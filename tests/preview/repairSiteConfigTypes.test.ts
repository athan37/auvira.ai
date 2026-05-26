import { describe, it, expect } from 'vitest';
import { repairSiteConfigTypesContent } from '../../src/lib/preview/repairSiteConfigTypes';

describe('repairSiteConfigTypesContent', () => {
  it('adds gallery to SiteSection union when sections use gallery', () => {
    const broken = `export type SiteSection = {
  type: "services" | "about" | "features" | "faq" | "testimonials" | "contact" | "generic";
  title: string;
};
export const siteConfig = {
  "sections": [{ "type": "gallery", "title": "Our Products" }]
};`;
    const { content, repaired } = repairSiteConfigTypesContent(broken);
    expect(repaired).toBe(true);
    expect(content).toMatch(/gallery/);
  });
});

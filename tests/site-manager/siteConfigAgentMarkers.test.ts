import { describe, it, expect } from 'vitest';
import {
  appendSiteConfigGallerySyncExport,
  stripAgentSyncMarkers,
} from '../../src/lib/site-manager/siteConfigAgentMarkers';
import {
  parseSiteConfigSource,
  replaceSiteConfigSectionsInSource,
} from '../../src/lib/site-manager/siteConfigParser';
import { stampSiteConfigForGalleryPreviewReload } from '../../src/lib/project-workspace/website-edit-agent/gallerySiteConfig';

const withHero = `export const siteConfig: SiteConfig = {
  "hero": { "headline": "Welcome", "subheadline": "Local pros" },
  "sections": [
    { "type": "about", "title": "Introduction", "body": "Who we are.", "items": [] },
    { "type": "services", "title": "Services", "items": [{ "title": "Repair" }] }
  ]
};`;

describe('siteConfigAgentMarkers', () => {
  it('stripAgentSyncMarkers removes legacy trailing comment stamps', () => {
    const stamped = `${withHero}\n// site-agent: siteconfig gallery sync 12345\n`;
    const stripped = stripAgentSyncMarkers(stamped);
    expect(stripped).not.toContain('siteconfig gallery sync');
    expect(parseSiteConfigSource(stripped)?.sections).toHaveLength(2);
  });

  it('stamp + parse round-trip keeps sections and hero', () => {
    const sections = parseSiteConfigSource(withHero)!.sections;
    const gallerySection = {
      type: 'gallery',
      title: 'Our work',
      body: 'Photos',
      items: [{ title: 'Photo 1', imageUrl: '/uploads/a.png' }],
    };
    const patched = replaceSiteConfigSectionsInSource(withHero, [
      { ...sections[0], ...gallerySection, type: 'gallery' },
      sections[1]!,
    ]);
    expect(patched).toContain('"hero"');

    const stamped = stampSiteConfigForGalleryPreviewReload(patched!);
    expect(stamped).toContain('__siteAgentGallerySync');
    const parsed = parseSiteConfigSource(stamped);
    expect(parsed?.sections.length).toBeGreaterThan(0);
    expect(stamped).toContain('"hero"');
    expect(stamped).not.toMatch(/siteconfig gallery sync \d+\s*$/m);
  });

  it('appendSiteConfigGallerySyncExport replaces prior sync export', () => {
    const once = appendSiteConfigGallerySyncExport(withHero);
    const twice = appendSiteConfigGallerySyncExport(once);
    expect((twice.match(/__siteAgentGallerySync/g) ?? []).length).toBe(1);
    expect(parseSiteConfigSource(twice)?.sections.length).toBe(2);
  });
});

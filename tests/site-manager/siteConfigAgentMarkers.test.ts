import { describe, it, expect } from 'vitest';
import {
  appendSiteConfigGallerySyncExport,
  appendSiteConfigPresentationSyncExport,
  hasInvalidNextJsPageExports,
  SITECONFIG_PRESENTATION_SYNC_EXPORT,
  sanitizeSourceForPublish,
  stripAgentSyncMarkers,
  stripInvalidNextJsPageExports,
} from '../../src/lib/site-manager/siteConfigAgentMarkers';
import {
  parseSiteConfigSource,
  replaceSiteConfigSectionsInSource,
} from '../../src/lib/site-manager/siteConfigParser';
import { stampSiteConfigForGalleryPreviewReload } from '../../src/lib/project-workspace/edit-shared/gallerySiteConfig';

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
    expect(stamped).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
    const parsed = parseSiteConfigSource(stamped);
    expect(parsed?.sections.length).toBeGreaterThan(0);
    expect(stamped).toContain('"hero"');
    expect(stamped).not.toMatch(/siteconfig gallery sync \d+\s*$/m);
  });

  it('appendSiteConfigGallerySyncExport replaces prior sync export', () => {
    const once = appendSiteConfigGallerySyncExport(withHero);
    const twice = appendSiteConfigGallerySyncExport(once);
    expect((twice.match(new RegExp(SITECONFIG_PRESENTATION_SYNC_EXPORT, 'g')) ?? []).length).toBe(
      1
    );
    expect(parseSiteConfigSource(twice)?.sections.length).toBe(2);
  });

  it('appendSiteConfigPresentationSyncExport bumps __siteConfigSyncVersion', () => {
    const stamped = appendSiteConfigPresentationSyncExport(withHero);
    expect(stamped).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
    const clean = sanitizeSourceForPublish('src/lib/siteConfig.ts', stamped);
    expect(clean).not.toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
  });

  it('sanitizeSourceForPublish strips agent markers from page and siteConfig', () => {
    const page = 'export default function Home() { return null; }\n// site-agent: page gallery sync 99\n';
    const cfg = `${withHero}\nexport const ${SITECONFIG_PRESENTATION_SYNC_EXPORT} = 123;\n`;
    const cleanPage = sanitizeSourceForPublish('src/app/page.tsx', page);
    const cleanCfg = sanitizeSourceForPublish('src/lib/siteConfig.ts', cfg);
    expect(cleanPage).not.toContain('page gallery sync');
    expect(cleanCfg).not.toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
    expect(parseSiteConfigSource(cleanCfg)?.sections).toHaveLength(2);
  });

  it('hasInvalidNextJsPageExports detects legacy page stamps', () => {
    const dirty = 'export default function Home() {}\nexport const __siteAgentPageGallerySync = 1;\n';
    expect(hasInvalidNextJsPageExports(dirty)).toBe(true);
    expect(hasInvalidNextJsPageExports(stripInvalidNextJsPageExports(dirty))).toBe(false);
  });

  it('sanitizeSourceForPublish removes legacy __siteAgentPageGallerySync export from page.tsx', () => {
    const page = `export default function Home() { return null; }
export const __siteAgentPageGallerySync = 1234567890;
`;
    const clean = sanitizeSourceForPublish('src/app/page.tsx', page);
    expect(clean).not.toContain('__siteAgentPageGallerySync');
    expect(clean).toContain('export default function Home');
  });
});

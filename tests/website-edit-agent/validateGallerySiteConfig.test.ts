import { describe, it, expect } from 'vitest';
import {
  applyImagePlacementToSiteConfig,
} from '../../src/lib/project-workspace/website-edit-agent/applyImagePlacementPlan';
import { planImagePlacementFallback } from '../../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { analyzeSiteStructureForImages } from '../../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { validateGalleryInSiteConfigSource } from '../../src/lib/project-workspace/website-edit-agent/validateGallerySiteConfig';

const siteConfig = `export const siteConfig: SiteConfig = {
  "sections": [
    { "type": "services", "title": "Our Products", "items": [
      { "title": "Photo 1" }, { "title": "Photo 2" }
    ]},
    { "type": "services", "title": "Real Services", "items": [{ "title": "AC Repair" }] }
  ]
};`;

const page = `
function SectionRenderer({ section }) {
  switch (section.type) {
    case 'services': return <ServicesSection />;
    case 'gallery': return <GallerySection />;
    default: return null;
  }
}
`;

describe('validateGallerySiteConfig', () => {
  it('replaces mistaken services product block with gallery + imageUrl', () => {
    const snap = analyzeSiteStructureForImages(siteConfig, page);
    const plan = planImagePlacementFallback(snap, 'add product images');
    const attachments = [
      {
        id: '1',
        path: 'public/uploads/a.png',
        publicUrl: '/uploads/a.png',
        previewUrl: '/uploads/a.png',
        originalName: 'a.png',
        mimeType: 'image/png',
        size: 1,
      },
    ];
    const out = applyImagePlacementToSiteConfig(siteConfig, plan, attachments, snap);
    const check = validateGalleryInSiteConfigSource(out, attachments);
    expect(check.ok).toBe(true);
    expect(out).toContain('"type": "gallery"');
    expect(out).toContain('/uploads/a.png');
    expect(out).not.toMatch(/"type": "services"[^}]*"Our Products"/);
  });
});

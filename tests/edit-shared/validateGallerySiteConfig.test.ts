import { describe, it, expect } from 'vitest';
import {
  applyImagePlacementToSiteConfig,
} from '../../src/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import { planImagePlacementFallback } from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { analyzeSiteStructureForImages } from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { validateGalleryInSiteConfigSource } from '../../src/lib/project-workspace/edit-shared/validateGallerySiteConfig';

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

  it('validates the gallery section that contains the current upload batch when multiple exist', () => {
    const dualGallery = `export const siteConfig: SiteConfig = {
  "sections": [
    {
      "type": "gallery",
      "title": "Old Gallery",
      "items": [{ "title": "Old", "imageUrl": "/uploads/old.png" }]
    },
    {
      "type": "gallery",
      "title": "New Gallery",
      "items": [
        { "title": "A", "imageUrl": "/uploads/a.png" },
        { "title": "B", "imageUrl": "/uploads/b.png" }
      ]
    }
  ]
};`;
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
      {
        id: '2',
        path: 'public/uploads/b.png',
        publicUrl: '/uploads/b.png',
        previewUrl: '/uploads/b.png',
        originalName: 'b.png',
        mimeType: 'image/png',
        size: 1,
      },
    ];
    const check = validateGalleryInSiteConfigSource(dualGallery, attachments);
    expect(check.ok).toBe(true);
  });
});

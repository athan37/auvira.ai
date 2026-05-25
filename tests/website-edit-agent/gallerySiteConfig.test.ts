import { describe, it, expect } from 'vitest';
import {
  buildGallerySectionPayload,
  humanizeImageItemTitle,
  inferGalleryPlacement,
  insertGallerySectionInSiteConfig,
  stripExistingGallerySections,
} from '../../src/lib/project-workspace/website-edit-agent/gallerySiteConfig';

describe('gallerySiteConfig', () => {
  const before = `export const siteConfig = { "sections": [
    { "type": "services", "title": "Services", "items": [] },
    { "type": "about", "title": "About", "items": [] }
  ] };`;

  it('inserts gallery after services by default', () => {
    const section = buildGallerySectionPayload(
      [
        {
          id: '1',
          path: 'public/uploads/a.png',
          publicUrl: '/uploads/a.png',
          previewUrl: '/uploads/a.png',
          originalName: '3.17.png',
          mimeType: 'image/png',
          size: 100,
        },
      ],
      'important images of our product'
    );

    const after = insertGallerySectionInSiteConfig(before, section, 'after:services');
    expect(after).toContain('"type": "gallery"');
    expect(after).toContain('/uploads/a.png');
    expect(after).toContain('Photo 1');
    const servicesIdx = after.indexOf('"type": "services"');
    const galleryIdx = after.indexOf('"type": "gallery"');
    const aboutIdx = after.indexOf('"type": "about"');
    expect(servicesIdx).toBeLessThan(galleryIdx);
    expect(galleryIdx).toBeLessThan(aboutIdx);
  });

  it('humanizes numeric filenames', () => {
    expect(humanizeImageItemTitle('3.17.png', 0)).toBe('Photo 1');
  });

  it('strips duplicate gallery blocks', () => {
    const messy = `${before.slice(0, -5)},
    { "type": "generic", "items": [{ "imageUrl": "/uploads/old.png" }] }
  ] };`;
    const stripped = stripExistingGallerySections(messy);
    expect(stripped).not.toContain('/uploads/old.png');
  });

  it('infers placement from owner message', () => {
    expect(inferGalleryPlacement('put below the hero', before)).toBe('prepend');
    expect(inferGalleryPlacement('after services section', before)).toBe('after:services');
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildGallerySectionPayload,
  prependGallerySectionInSiteConfig,
} from '../../src/lib/project-workspace/website-edit-agent/gallerySiteConfig';

describe('gallerySiteConfig', () => {
  it('prepends documentation section with imageUrl items', () => {
    const before = `export const siteConfig = { "sections": [
    { "type": "services", "title": "Services", "items": [] }
  ] };`;

    const section = buildGallerySectionPayload(
      [
        {
          id: '1',
          path: 'public/uploads/a.png',
          publicUrl: '/uploads/a.png',
          previewUrl: '/uploads/a.png',
          originalName: 'a.png',
          mimeType: 'image/png',
          size: 100,
        },
      ],
      'important images of our product'
    );

    const after = prependGallerySectionInSiteConfig(before, section);
    expect(after).toContain('"type": "documentation"');
    expect(after).toContain('/uploads/a.png');
    expect(after.indexOf('documentation')).toBeLessThan(after.indexOf('services'));
  });
});

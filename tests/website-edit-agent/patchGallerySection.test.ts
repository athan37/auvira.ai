import { describe, it, expect } from 'vitest';
import {
  patchGallerySectionInPage,
  pageHasGalleryRenderer,
} from '../../src/lib/project-workspace/website-edit-agent/patchGallerySection';

describe('patchGallerySection', () => {
  const page = `
function SectionRenderer({ section }) {
  switch (section.type) {
    case 'services': return null;
    default: return null;
  }
}
`;

  it('adds GallerySection and gallery case', () => {
    const { content, patched } = patchGallerySectionInPage(page);
    expect(patched).toBe(true);
    expect(content).toContain('function GallerySection');
    expect(content).toContain("case 'gallery'");
    expect(pageHasGalleryRenderer(content)).toBe(true);
  });
});

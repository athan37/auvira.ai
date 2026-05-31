import { describe, it, expect } from 'vitest';
import {
  analyzeSiteStructureForImages,
  planImagePlacementFallback,
} from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';

const siteConfig = `export const siteConfig = {
  "sections": [
    { "type": "services", "title": "Services", "items": [] },
    { "type": "about", "title": "About", "items": [] }
  ]
};`;

const page = `
function SectionRenderer({ section }) {
  switch (section.type) {
    case 'services': return <ServicesSection />;
    case 'about': return <AboutSection />;
    default: return null;
  }
}
{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}
`;

describe('siteStructureAnalysis', () => {
  it('lists sections and detects default null', () => {
    const snap = analyzeSiteStructureForImages(siteConfig, page);
    expect(snap.sections).toHaveLength(2);
    expect(snap.defaultRendersNull).toBe(true);
    expect(snap.sectionTypesInPage).toContain('services');
  });

  it('fallback inserts after services when present', () => {
    const snap = analyzeSiteStructureForImages(siteConfig, page);
    const plan = planImagePlacementFallback(snap, 'add product photos');
    expect(plan.action).toBe('create_section');
    expect(plan.insertAfterSectionType).toBe('services');
  });

  it('fallback updates existing image section', () => {
    const withGallery = siteConfig.replace(
      '"sections": [',
      '"sections": [{ "type": "gallery", "title": "Photos", "items": [{ "imageUrl": "/uploads/a.png" }] },'
    );
    const snap = analyzeSiteStructureForImages(withGallery, page);
    const plan = planImagePlacementFallback(snap, 'add more');
    expect(plan.action).toBe('update_section');
    expect(plan.targetSectionIndex).toBe(0);
  });
});

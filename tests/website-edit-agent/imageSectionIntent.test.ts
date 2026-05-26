import { describe, it, expect } from 'vitest';
import { applyImagePlacementToSiteConfig } from '../../src/lib/project-workspace/website-edit-agent/applyImagePlacementPlan';
import { planImagePlacementFallback } from '../../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { analyzeSiteStructureForImages } from '../../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { validateGalleryInSiteConfigSource } from '../../src/lib/project-workspace/website-edit-agent/validateGallerySiteConfig';

const introSiteConfig = `export const siteConfig: SiteConfig = {
  "sections": [
    { "type": "about", "title": "Introduction", "body": "Who we are.", "items": [] },
    { "type": "services", "title": "Our Services", "items": [{ "title": "Repair" }] }
  ]
};`;

const attachments = [
  {
    id: '1',
    path: 'public/uploads/intro.png',
    publicUrl: '/uploads/intro.png',
    previewUrl: '/uploads/intro.png',
    originalName: 'intro.png',
    mimeType: 'image/png',
    size: 1,
  },
];

describe('imageSectionIntent', () => {
  it('updates Introduction section in place when owner asks for introduction', () => {
    const page = `export default function Home() {
      return siteConfig.sections.map(s => <SectionRenderer section={s} />);
    }
    function SectionRenderer({ section }) {
      switch (section.type) {
        case 'gallery': return <GallerySection />;
        case 'about': return <AboutSection />;
        default: return null;
      }
    }`;
    const snap = analyzeSiteStructureForImages(introSiteConfig, page);
    const plan = planImagePlacementFallback(snap, 'add this image to the introduction section');
    expect(plan.action).toBe('update_section');
    expect(plan.targetSectionTitle).toMatch(/introduction/i);

    const out = applyImagePlacementToSiteConfig(
      introSiteConfig,
      plan,
      attachments,
      snap,
      'add this image to the introduction section'
    );

    expect(out).toContain('/uploads/intro.png');
    expect(out).toContain('"type": "gallery"');
    expect(out).toMatch(/"title":\s*"Introduction"/);
    expect((out.match(/"type":\s*"gallery"/g) ?? []).length).toBe(1);

    const check = validateGalleryInSiteConfigSource(out, attachments);
    expect(check.ok).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  applyImagePlacementToSiteConfig,
  mergeGallerySectionItems,
} from '../../src/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import { planImagePlacementFallback } from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { analyzeSiteStructureForImages } from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import {
  pageCanRenderGallerySection,
  patchPageForUploadedImages,
} from '../../src/lib/project-workspace/edit-shared/patchGenericSectionImages';
import type { WorkspaceAssetAttachment } from '../../src/lib/project-workspace/workspaceAssetTypes';

const HVAC_CONFIG = `export const siteConfig: SiteConfig = {
  "businessName": "Houston HVAC",
  "hero": { "headline": "HVAC Pros" },
  "navigation": [{ "label": "Home", "href": "#top" }],
  "sections": [
    { "type": "generic", "title": "Promo", "items": [{ "title": "A" }] },
    { "type": "services", "title": "Services", "items": [{ "title": "AC Repair" }] },
    { "type": "about", "title": "About", "items": [] }
  ]
};`;

let HVAC_PAGE = '';
try {
  HVAC_PAGE = readFileSync(
    path.join(
      process.cwd(),
      '.tmp/git-workspaces/6a135ba264e7672599597ea1/repo/src/app/page.tsx'
    ),
    'utf8'
  );
} catch {
  HVAC_PAGE = '';
}

const MIN_PAGE = `
function SectionRenderer({ section }) {
  switch (section.type) {
    case 'services': return <ServicesSection />;
    case 'about': return <AboutSection />;
    default: return null;
  }
}
export default function Home() {
  return <main>{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}</main>;
}
`;

const attachments: WorkspaceAssetAttachment[] = [
  {
    id: '1',
    path: 'public/uploads/a.png',
    publicUrl: '/uploads/a.png',
    previewUrl: '/uploads/a.png',
    originalName: 'product-1.png',
    mimeType: 'image/png',
    size: 100,
  },
  {
    id: '2',
    path: 'public/uploads/b.png',
    publicUrl: '/uploads/b.png',
    previewUrl: '/uploads/b.png',
    originalName: 'product-2.png',
    mimeType: 'image/png',
    size: 100,
  },
];

describe('applyImagePlacementPlan', () => {
  it('fills empty gallery placeholder slots with uploaded images', () => {
    const placeholders = Array.from({ length: 3 }, (_, i) => ({
      title: `Gallery Image ${i + 1}`,
      imageUrl: '',
    }));
    const merged = mergeGallerySectionItems(placeholders, attachments.slice(0, 2));
    expect(merged).toHaveLength(2);
    expect(merged[0].imageUrl).toBe('/uploads/a.png');
    expect(merged[1].imageUrl).toBe('/uploads/b.png');
  });

  it('creates gallery after services and preserves navigation', () => {
    const snap = analyzeSiteStructureForImages(HVAC_CONFIG, MIN_PAGE);
    const plan = planImagePlacementFallback(snap, 'make a section for product images');
    const out = applyImagePlacementToSiteConfig(HVAC_CONFIG, plan, attachments, snap);

    expect(out).toContain('"navigation"');
    expect(out).toContain('"businessName"');
    expect(out).toContain('/uploads/a.png');
    expect(out).toContain('/uploads/b.png');
    expect(out).toContain('"type": "gallery"');

    const servicesIdx = out.indexOf('"type": "services"');
    const galleryIdx = out.indexOf('"type": "gallery"');
    const aboutIdx = out.indexOf('"type": "about"');
    expect(servicesIdx).toBeGreaterThan(-1);
    expect(galleryIdx).toBeGreaterThan(servicesIdx);
    expect(aboutIdx).toBeGreaterThan(galleryIdx);
  });

  it('patches page so gallery renders', () => {
    const { content, patched } = patchPageForUploadedImages(MIN_PAGE);
    expect(patched).toBe(true);
    expect(pageCanRenderGallerySection(content)).toBe(true);
    expect(content).toContain("case 'gallery'");
  });

  it('integration: real HVAC page.tsx accepts gallery patch', () => {
    if (!HVAC_PAGE || HVAC_PAGE.length < 1000) {
      return;
    }
    const { content, patched } = patchPageForUploadedImages(HVAC_PAGE);
    expect(patched || pageCanRenderGallerySection(HVAC_PAGE)).toBe(true);
    if (patched) {
      expect(pageCanRenderGallerySection(content)).toBe(true);
    }
  });
});

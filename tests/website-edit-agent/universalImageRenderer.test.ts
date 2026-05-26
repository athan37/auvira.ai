import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  applyUniversalImageRenderer,
  canRenderUploadedImages,
  gallerySectionRendersItemImages,
  pageHasGalleryRenderer,
  patchSectionRendererDisabledCases,
  sectionRendererRoutesGallery,
  stampPageForGalleryPreviewReload,
} from '../../src/lib/project-workspace/website-edit-agent/universalImageRenderer';

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/workspaces');

describe('universalImageRenderer', () => {
  it('patches default-null fixture to gallery + generic routing', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'default-null/src/app/page.tsx'),
      'utf8'
    );
    const { content, patched, anchors } = applyUniversalImageRenderer(page, 'section_loop');
    expect(patched).toBe(true);
    expect(anchors.length).toBeGreaterThan(0);
    expect(content).toContain("case 'gallery'");
    expect(content).not.toContain('default: return null');
    expect(pageHasGalleryRenderer(content)).toBe(true);
  });

  it('scaffolds hardcoded-no-loop fixture', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'hardcoded-no-loop/src/app/page.tsx'),
      'utf8'
    );
    const { content, patched } = applyUniversalImageRenderer(page, 'hardcoded');
    expect(patched).toBe(true);
    expect(content).toContain('siteConfig.sections');
    expect(canRenderUploadedImages(content, 'hardcoded')).toBe(true);
  });

  it('section-loop-default can render after generic image grid patch', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
      'utf8'
    );
    expect(canRenderUploadedImages(page, 'section_loop')).toBe(true);
  });

  it('enables gallery switch case when it returns null despite GallerySection existing', () => {
    const brokenPage = `
function GallerySection({ section }: { section: SiteSection }) {
  return (
    <section>
      {section.items
        ?.filter((item) => (item as { imageUrl?: string }).imageUrl)
        .map((item, i) => (
        <img key={i} src={(item as { imageUrl: string }).imageUrl} alt="" />
      ))}
    </section>
  );
}
function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case "gallery": return null;
    case "generic": return null;
    default: return null;
  }
}
`;
    expect(gallerySectionRendersItemImages(brokenPage)).toBe(true);
    expect(sectionRendererRoutesGallery(brokenPage)).toBe(false);
    expect(pageHasGalleryRenderer(brokenPage)).toBe(false);

    const { content, patched, anchors } = patchSectionRendererDisabledCases(brokenPage);
    expect(patched).toBe(true);
    expect(anchors).toContain('gallery_case_enabled');
    expect(sectionRendererRoutesGallery(content)).toBe(true);
    expect(pageHasGalleryRenderer(content)).toBe(true);
    expect(content).not.toMatch(/case\s*['"]gallery['"]\s*:\s*return\s*null/);
  });

  it('replaces stub GallerySection that does not render imageUrl', () => {
    const stubPage = `
function GallerySection({ section }: { section: SiteSection }) {
  return (
    <section>
      <h2>{section.title}</h2>
      <p>{section.body}</p>
    </section>
  );
}
function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case 'gallery': return <GallerySection section={section} />;
    default: return null;
  }
}
export default function Home() {
  return siteConfig.sections.map((s) => <SectionRenderer key={s.title} section={s} />);
}
`;
    expect(gallerySectionRendersItemImages(stubPage)).toBe(false);
    const { content, patched, anchors } = applyUniversalImageRenderer(stubPage, 'section_loop');
    expect(patched).toBe(true);
    expect(anchors).toContain('replace_gallery_component');
    expect(gallerySectionRendersItemImages(content)).toBe(true);
    expect(pageHasGalleryRenderer(content)).toBe(true);
  });

  it('stampPageForGalleryPreviewReload appends parse-safe sync export for dev reload', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
      'utf8'
    );
    const stamped = stampPageForGalleryPreviewReload(page);
    expect(stamped).toContain('__siteAgentPageGallerySync');
    expect(stamped.length).toBeGreaterThan(page.length);
    const restamped = stampPageForGalleryPreviewReload(stamped);
    expect((restamped.match(/__siteAgentPageGallerySync/g) ?? []).length).toBe(1);
  });
});

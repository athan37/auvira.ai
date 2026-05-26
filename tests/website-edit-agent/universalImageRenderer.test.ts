import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  applyUniversalImageRenderer,
  canRenderUploadedImages,
  pageHasGalleryRenderer,
  stampPageForGalleryPreviewReload,
  GALLERY_PREVIEW_SYNC_MARKER,
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

  it('stampPageForGalleryPreviewReload appends sync marker for dev reload', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
      'utf8'
    );
    const stamped = stampPageForGalleryPreviewReload(page);
    expect(stamped).toContain(GALLERY_PREVIEW_SYNC_MARKER);
    expect(stamped.length).toBeGreaterThan(page.length);
    const restamped = stampPageForGalleryPreviewReload(stamped);
    expect(restamped.match(new RegExp(GALLERY_PREVIEW_SYNC_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length).toBe(1);
  });
});

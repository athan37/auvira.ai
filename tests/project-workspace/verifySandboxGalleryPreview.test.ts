import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  applyImagePlacementToSiteConfig,
} from '../../src/lib/project-workspace/website-edit-agent/applyImagePlacementPlan';
import {
  analyzeSiteStructureForImages,
  planImagePlacementFallback,
} from '../../src/lib/project-workspace/website-edit-agent/siteStructureAnalysis';
import { validateGalleryInSiteConfigSource } from '../../src/lib/project-workspace/website-edit-agent/validateGallerySiteConfig';
import { verifyEditVisibleInPreview } from '../../src/lib/project-workspace/verifyEditVisibleInPreview';
import {
  countReachableUploadAssets,
  verifyGalleryEditOnSandbox,
} from '../../src/lib/project-workspace/verifySandboxGalleryPreview';

vi.mock('../../src/lib/project-workspace/verifyEditVisibleInPreview', () => ({
  verifyEditVisibleInPreview: vi.fn(),
}));

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/workspaces');
const mockedVerifyHtml = vi.mocked(verifyEditVisibleInPreview);

const siteConfigFixture = `export const siteConfig: SiteConfig = {
  "sections": [
    { "type": "services", "title": "Our Products", "items": [
      { "title": "Photo 1" }, { "title": "Photo 2" }
    ]},
    { "type": "services", "title": "Real Services", "items": [{ "title": "AC Repair" }] }
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
] as const;

function gallerySiteConfigSource(): string {
  const snap = analyzeSiteStructureForImages(siteConfigFixture, '');
  const plan = planImagePlacementFallback(snap, 'add product images');
  return applyImagePlacementToSiteConfig(siteConfigFixture, plan, [...attachments], snap);
}

function galleryPageSource(): string {
  return readFileSync(
    path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
    'utf8'
  );
}

describe('verifySandboxGalleryPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedVerifyHtml.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('passes when uploaded image paths appear in preview HTML', async () => {
    mockedVerifyHtml.mockResolvedValue({
      ok: true,
      reason: 'Preview shows 1/1 uploaded image(s).',
      htmlLength: 8000,
      imagesFound: 1,
      phraseMatched: false,
    });

    const siteConfigSource = gallerySiteConfigSource();
    expect(validateGalleryInSiteConfigSource(siteConfigSource, [...attachments]).ok).toBe(true);

    const promise = verifyGalleryEditOnSandbox({
      previewUrl: 'https://sandbox.example',
      siteConfigSource,
      pageSource: galleryPageSource(),
      attachments: [...attachments],
    });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(result.imagesFound).toBe(1);
    expect(mockedVerifyHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        previewUrl: 'https://sandbox.example',
        imagePaths: ['/uploads/a.png'],
        retries: 6,
        delayMs: 3000,
      })
    );
  });

  it('fails when HTML lacks images even if upload URLs are reachable', async () => {
    mockedVerifyHtml.mockResolvedValue({
      ok: false,
      reason:
        'Preview loaded (12000 bytes) but none of the uploaded image paths appeared in the page HTML.',
      htmlLength: 12000,
      imagesFound: 0,
      phraseMatched: false,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );

    const promise = verifyGalleryEditOnSandbox({
      previewUrl: 'https://sandbox.example',
      siteConfigSource: gallerySiteConfigSource(),
      pageSource: galleryPageSource(),
      attachments: [...attachments],
    });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('did not render them yet');
    expect(result.reason).toContain('Upload files exist (1/1)');
  });

  it('countReachableUploadAssets reports HTTP 200 uploads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );

    const count = await countReachableUploadAssets('https://sandbox.example', [...attachments]);
    expect(count).toBe(1);
  });
});

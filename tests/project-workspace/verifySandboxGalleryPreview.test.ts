import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  applyImagePlacementToSiteConfig,
} from '../../src/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import {
  analyzeSiteStructureForImages,
  planImagePlacementFallback,
} from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { applyUniversalImageRenderer } from '../../src/lib/project-workspace/edit-shared/universalImageRenderer';
import {
  countReachableUploadAssets,
  verifyGalleryEditOnSandbox,
} from '../../src/lib/project-workspace/verifySandboxGalleryPreview';
import { htmlContainsUploadedImage } from '../../src/lib/project-workspace/previewImageHtml';

vi.mock('../../src/lib/sandbox/fetchSandboxPreviewHtml', () => ({
  fetchHtmlFromSandboxLoopback: vi.fn(),
}));

vi.mock('../../src/lib/project-workspace/fetchSandboxPreviewHtmlForVerify', () => ({
  fetchSandboxPreviewHtmlForVerify: vi.fn(),
}));

import { fetchHtmlFromSandboxLoopback } from '../../src/lib/sandbox/fetchSandboxPreviewHtml';
import { fetchSandboxPreviewHtmlForVerify } from '../../src/lib/project-workspace/fetchSandboxPreviewHtmlForVerify';

const mockedLoopback = vi.mocked(fetchHtmlFromSandboxLoopback);
const mockedSandboxFetch = vi.mocked(fetchSandboxPreviewHtmlForVerify);

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/workspaces');

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

/** Page as the agent would leave it after universal renderer (can show gallery item images). */
function galleryPageSource(): string {
  const base = readFileSync(
    path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
    'utf8'
  );
  return applyUniversalImageRenderer(base, 'section_loop').content;
}

describe('verifySandboxGalleryPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedLoopback.mockReset();
    mockedSandboxFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('htmlContainsUploadedImage matches RSC payloads', () => {
    expect(
      htmlContainsUploadedImage('{"imageUrl":"/uploads/a.png"}', '/uploads/a.png')
    ).toBe(true);
  });

  it('passes when internal sandbox fetch HTML includes uploaded image', async () => {
    mockedSandboxFetch.mockResolvedValue(
      `<html>${'x'.repeat(2000)}<img src="/uploads/a.png" /></html>`
    );
    mockedLoopback.mockResolvedValue('');

    const promise = verifyGalleryEditOnSandbox({
      previewUrl: 'https://sandbox.example',
      projectId: 'proj1',
      siteConfigSource: gallerySiteConfigSource(),
      pageSource: galleryPageSource(),
      attachments: [...attachments],
    });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(result.imagesFound).toBe(1);
    expect(result.reason).toContain('Sandbox preview');
    expect(mockedSandboxFetch).toHaveBeenCalledWith('proj1');
  });

  it('passes when loopback HTML includes uploaded image if sandbox fetch is empty', async () => {
    mockedSandboxFetch.mockResolvedValue('');
    mockedLoopback.mockResolvedValue(
      `<html>${'x'.repeat(2000)}<img src="/uploads/a.png" /></html>`
    );

    const promise = verifyGalleryEditOnSandbox({
      previewUrl: 'https://sandbox.example',
      projectId: 'proj1',
      siteConfigSource: gallerySiteConfigSource(),
      pageSource: galleryPageSource(),
      attachments: [...attachments],
    });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(result.imagesFound).toBe(1);
    expect(mockedLoopback).toHaveBeenCalled();
  });

  it('fails when HTML lacks images even if upload URLs are reachable', async () => {
    mockedSandboxFetch.mockResolvedValue(`<html>${'x'.repeat(5000)}</html>`);
    mockedLoopback.mockResolvedValue(`<html>${'y'.repeat(5000)}</html>`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `<html>${'z'.repeat(5000)}</html>`,
      })
    );

    const promise = verifyGalleryEditOnSandbox({
      previewUrl: 'https://sandbox.example',
      projectId: 'proj1',
      siteConfigSource: gallerySiteConfigSource(),
      pageSource: galleryPageSource(),
      attachments: [...attachments],
    });
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(3500 * 10);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('does not include uploaded image paths');
  });

  it('fails fast when page has gallery case return null despite GallerySection component', async () => {
    vi.useRealTimers();
    const brokenPage = `
function GallerySection({ section }: { section: SiteSection }) {
  return section.items?.filter((item) => (item as { imageUrl?: string }).imageUrl).map((item, i) => (
    <img key={i} src={(item as { imageUrl: string }).imageUrl} alt="" />
  ));
}
function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case "gallery": return null;
    default: return null;
  }
}`;
    const result = await verifyGalleryEditOnSandbox({
      previewUrl: 'http://127.0.0.1:9',
      siteConfigSource: gallerySiteConfigSource(),
      pageSource: brokenPage,
      attachments: [...attachments],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('cannot render gallery');
    expect(mockedSandboxFetch).not.toHaveBeenCalled();
    vi.useFakeTimers();
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

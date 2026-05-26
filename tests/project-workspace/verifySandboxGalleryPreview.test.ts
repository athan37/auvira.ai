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

function galleryPageSource(): string {
  return readFileSync(
    path.join(FIXTURES, 'section-loop-default/src/app/page.tsx'),
    'utf8'
  );
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

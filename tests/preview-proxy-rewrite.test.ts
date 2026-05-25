import { describe, it, expect } from 'vitest';
import { rewriteHtmlAssetPaths } from '../src/lib/project-workspace/previewProxyRewrite';

describe('rewriteHtmlAssetPaths', () => {
  const projectId = 'abc123';
  const base = `/api/projects/${projectId}/preview/proxy`;

  it('rewrites link stylesheet href', () => {
    const html =
      '<link rel="stylesheet" href="/_next/static/css/app/layout.css?v=1" />';
    const out = rewriteHtmlAssetPaths(html, projectId);
    expect(out).toContain(`href="${base}/_next/static/css/app/layout.css?v=1"`);
  });

  it('rewrites _next paths inside RSC script payloads', () => {
    const html =
      'self.__next_f.push([1,"1:HL[\\"/_next/static/css/app/layout.css\\",\\"style\\"]\\n"])';
    const out = rewriteHtmlAssetPaths(html, projectId);
    expect(out).toContain(`${base}/_next/static/css/app/layout.css`);
    expect(out).not.toMatch(/"\/_next\//);
  });

  it('rewrites owner upload image src paths', () => {
    const html = '<img src="/uploads/hero-abc123.png" alt="Team" />';
    const out = rewriteHtmlAssetPaths(html, projectId);
    expect(out).toContain(`src="${base}/uploads/hero-abc123.png"`);
  });

  it('rewrites upload paths in CSS url()', () => {
    const css = '.hero { background-image: url(/uploads/banner.png); }';
    const out = rewriteHtmlAssetPaths(css, projectId);
    expect(out).toContain(`url(${base}/uploads/banner.png)`);
  });
});

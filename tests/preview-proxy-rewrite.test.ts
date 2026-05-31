import { describe, it, expect } from 'vitest';
import {
  injectPreviewChunkErrorRecovery,
  isPreviewRewriteableContentType,
  rewriteHtmlAssetPaths,
  rewritePreviewResponseBody,
} from '../src/lib/project-workspace/previewProxyRewrite';

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

  it('rewrites webpack chunk paths in JavaScript bundles', () => {
    const js =
      '__webpack_require__.u=function(e){return"/_next/static/chunks/"+e+".js"};';
    const out = rewritePreviewResponseBody(
      Buffer.from(js),
      'application/javascript',
      projectId
    );
    expect(out.rewritten).toBe(true);
    expect(String(out.body)).toContain(`${base}/_next/static/chunks/`);
    expect(String(out.body)).not.toContain('"/_next/static/chunks/');
  });

  it('detects rewriteable JavaScript content types', () => {
    expect(isPreviewRewriteableContentType('application/javascript')).toBe(true);
    expect(isPreviewRewriteableContentType('text/javascript; charset=utf-8')).toBe(true);
    expect(isPreviewRewriteableContentType('image/png')).toBe(false);
  });

  it('injects chunk error recovery script into HTML', () => {
    const html = '<html><head></head><body></body></html>';
    const out = injectPreviewChunkErrorRecovery(html);
    expect(out).toContain('preview-chunk-error');
    expect(out).toContain('</head>');
  });

  it('always marks HTML injection as rewritten even when asset paths are unchanged', () => {
    const html = '<html><head></head><body><section id="services">Services</section></body></html>';
    const out = rewritePreviewResponseBody(Buffer.from(html), 'text/html', projectId);
    expect(out.rewritten).toBe(true);
    expect(String(out.body)).toContain('preview/section-bridge');
    expect(String(out.body)).toContain('cursor:grab');
  });
});

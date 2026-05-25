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
});

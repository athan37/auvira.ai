import { describe, it, expect } from 'vitest';
import { extractPreviewCompileErrorFromHtml } from '../../src/lib/preview/extractPreviewCompileError';

describe('extractPreviewCompileErrorFromHtml', () => {
  it('parses ModuleBuildError from __NEXT_DATA__', () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      err: {
        message:
          'Module build failed\n  x Unexpected token `footer`. Expected jsx identifier\n     ,-[/vercel/sandbox/src/app/page.tsx:272:1]\n 272 |     <footer className="x">\n     :      ^^^^^^\n     `----',
      },
    })}</script></html>`;

    const msg = extractPreviewCompileErrorFromHtml(html);
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/footer/i);
    expect(msg).toMatch(/page\.tsx/i);
  });

  it('returns null when no error payload', () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { statusCode: 200 } },
    })}</script>`;
    expect(extractPreviewCompileErrorFromHtml(html)).toBeNull();
  });
});

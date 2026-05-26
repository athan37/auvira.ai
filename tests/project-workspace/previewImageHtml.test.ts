import { describe, it, expect } from 'vitest';
import {
  countUploadedImagesInHtml,
  htmlContainsUploadedImage,
} from '../../src/lib/project-workspace/previewImageHtml';

describe('previewImageHtml', () => {
  it('finds image in plain img src', () => {
    const html = '<img src="/uploads/hero-abc123.png" alt="x" />';
    expect(htmlContainsUploadedImage(html, '/uploads/hero-abc123.png')).toBe(true);
  });

  it('finds imageUrl in RSC-style JSON', () => {
    const html = '{"imageUrl":"/uploads/hero-abc123.png","title":"Photo"}';
    expect(htmlContainsUploadedImage(html, '/uploads/hero-abc123.png')).toBe(true);
  });

  it('counts multiple paths', () => {
    const html = '/uploads/a.png and /uploads/b.png';
    expect(countUploadedImagesInHtml(html, ['/uploads/a.png', '/uploads/b.png'])).toBe(2);
  });
});

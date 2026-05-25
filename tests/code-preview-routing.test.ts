import { describe, it, expect } from 'vitest';
import {
  isBlockedServePath,
  getContentType,
  buildPreviewNotReadyHtml,
} from '../src/lib/project-workspace/codePreviewServe';

describe('codePreviewServe', () => {
  it('blocks path traversal', () => {
    expect(isBlockedServePath('../secret')).toBe(true);
    expect(isBlockedServePath('foo/../../.env')).toBe(true);
  });

  it('blocks sensitive paths', () => {
    expect(isBlockedServePath('.env')).toBe(true);
    expect(isBlockedServePath('node_modules/pkg/index.js')).toBe(true);
    expect(isBlockedServePath('styles.css')).toBe(false);
  });

  it('returns correct content types', () => {
    expect(getContentType('index.html')).toContain('text/html');
    expect(getContentType('styles.css')).toContain('text/css');
    expect(getContentType('logo.png')).toBe('image/png');
  });

  it('builds preview-not-ready HTML with project id', () => {
    const html = buildPreviewNotReadyHtml('proj123', 'Missing index');
    expect(html).toContain('proj123');
    expect(html).toContain('Missing index');
    expect(html).toContain('Preview not ready');
  });
});

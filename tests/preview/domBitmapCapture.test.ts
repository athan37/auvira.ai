import { describe, expect, it } from 'vitest';
import {
  DOM_BITMAP_MAX_WIDTH,
  DOM_BITMAP_SECTION_MAX_HEIGHT,
  resolveDomBitmapDimensions,
} from '@/lib/preview/domBitmapCapture';
import { loadDomBitmapCaptureBundle } from '@/lib/preview/domBitmapCaptureBridge';
import { buildSectionBridgeScriptBody } from '@/lib/preview/sectionBridgeScript';

describe('resolveDomBitmapDimensions', () => {
  it('clips wide sections to max width and height', () => {
    const dims = resolveDomBitmapDimensions(
      { width: 1200, height: 600 },
      { isSection: true }
    );
    expect(dims.width).toBe(DOM_BITMAP_MAX_WIDTH);
    expect(dims.height).toBe(DOM_BITMAP_SECTION_MAX_HEIGHT);
    expect(dims.offsetY).toBe(0);
  });

  it('centers section clip around click offset', () => {
    const dims = resolveDomBitmapDimensions(
      { width: 800, height: 500 },
      { isSection: true, clickOffsetTop: 300 }
    );
    expect(dims.offsetY).toBeGreaterThan(0);
    expect(dims.offsetY).toBeLessThan(500);
  });

  it('caps element captures to element max height', () => {
    const dims = resolveDomBitmapDimensions(
      { width: 200, height: 80 },
      { isSection: false }
    );
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(80);
  });
});

describe('dom bitmap bridge bundle', () => {
  it('loads modern-screenshot bundle with domToPngDataUrl export', () => {
    const bundle = loadDomBitmapCaptureBundle();
    expect(bundle).toContain('PreviewDomCapture');
    expect(bundle).toContain('domToPngDataUrl');
  });

  it('embeds dom bitmap capture as primary path in bridge body', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function captureDomBitmap');
    expect(body).toContain('captureDomBitmap(captureEl,clickTarget)');
    expect(body).toContain('captureStyledPreviewFallback(payload,root,captureEl,leafKind,fullSection)');
    expect(body).toContain('PreviewDomCapture.domToPngDataUrl');
  });

  it('produces valid executable JavaScript', () => {
    const body = buildSectionBridgeScriptBody();
    expect(() => new Function(body)).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeDragGhostDimensions,
  fitScaleToBox,
  inferPreviewScaleProfile,
  PREVIEW_THUMB_MAX,
  SECTION_PREVIEW_THUMB_MAX,
  resolvePreviewThumbDisplaySize,
  resolvePreviewThumbSourceDimensions,
  shouldUpscaleCompactPreview,
} from '@/lib/preview/targetPreviewThumbnail';

describe('resolvePreviewThumbSourceDimensions', () => {
  it('prefers explicit capture metadata', () => {
    expect(
      resolvePreviewThumbSourceDimensions(
        {
          kind: 'section',
          previewThumbnail: { previewUrl: 'https://example.com/a.jpg', width: 112, height: 80 },
          previewCaptureWidth: 320,
          previewCaptureHeight: 48,
        },
        { width: 400, height: 60 }
      )
    ).toEqual({ width: 400, height: 60 });
  });

  it('uses thumbnail metadata when overrides are absent', () => {
    expect(
      resolvePreviewThumbSourceDimensions({
        kind: 'section',
        previewThumbnail: { previewUrl: 'https://example.com/a.jpg', width: 280, height: 160 },
      })
    ).toEqual({ width: 280, height: 160 });
  });

  it('falls back to heading heuristics for element pins', () => {
    expect(
      resolvePreviewThumbSourceDimensions({
        kind: 'hero',
        pinScope: 'element',
        elementKind: 'heading',
      })
    ).toEqual({ width: 320, height: 48 });
  });
});

describe('resolvePreviewThumbDisplaySize', () => {
  it('preserves wide heading aspect ratio within pinned max box', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 320, 48);
    expect(display.width).toBe(PREVIEW_THUMB_MAX.pinned.width);
    expect(display.height).toBeLessThanOrEqual(PREVIEW_THUMB_MAX.pinned.height);
    expect(display.height).toBeGreaterThan(20);
    expect(display.aspectRatio).toBe('320 / 48');
  });

  it('preserves button aspect ratio for pill variant', () => {
    const display = resolvePreviewThumbDisplaySize('pill', 120, 40);
    expect(display.width).toBeLessThanOrEqual(PREVIEW_THUMB_MAX.pill.width);
    expect(display.height).toBeLessThanOrEqual(PREVIEW_THUMB_MAX.pill.height);
    expect(display.width / display.height).toBeCloseTo(3, 0);
  });

  it('uses full container width when requested', () => {
    const display = resolvePreviewThumbDisplaySize('drag', 280, 90, {
      fullWidth: true,
      containerWidth: 152,
    });
    expect(display.width).toBe(152);
    expect(display.height).toBeLessThanOrEqual(PREVIEW_THUMB_MAX.drag.height);
  });
});

describe('fitScaleToBox', () => {
  it('never upscales small sources by default', () => {
    const fit = fitScaleToBox(40, 20, 168, 112);
    expect(fit.scale).toBeLessThanOrEqual(1);
    expect(fit.width).toBe(40);
    expect(fit.height).toBe(20);
  });

  it('can upscale compact chips when maxScale allows', () => {
    const fit = fitScaleToBox(96, 28, 168, 112, { maxScale: 3 });
    expect(fit.width).toBeGreaterThan(96);
    expect(fit.height).toBeGreaterThan(28);
  });
});

describe('shouldUpscaleCompactPreview', () => {
  it('applies to contact fields and buttons', () => {
    expect(shouldUpscaleCompactPreview('contact_field', 96, 28)).toBe(true);
    expect(shouldUpscaleCompactPreview('button', 140, 44)).toBe(true);
    expect(shouldUpscaleCompactPreview(undefined, 320, 40)).toBe(false);
  });
});

describe('resolvePreviewThumbDisplaySize contact_field', () => {
  it('preserves chip aspect ratio at a readable height without stretching full card width', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 200, 36, {
      fullWidth: true,
      containerWidth: PREVIEW_THUMB_MAX.pinned.width,
      elementKind: 'contact_field',
    });
    expect(display.height).toBe(40);
    expect(display.width).toBe(Math.round(200 * (40 / 36)));
  });
});

describe('resolvePreviewThumbDisplaySize button', () => {
  it('scales buttons larger while preserving aspect ratio', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 140, 44, {
      elementKind: 'button',
    });
    expect(display.height).toBe(48);
    expect(display.width / display.height).toBeCloseTo(140 / 44, 1);
  });
});

describe('inferPreviewScaleProfile', () => {
  it('treats wide composite captures as section scale even for heading pins', () => {
    expect(inferPreviewScaleProfile(400, 220, 'element', 'heading')).toBe('section');
    expect(inferPreviewScaleProfile(320, 48, 'element', 'heading')).toBe('element');
    expect(inferPreviewScaleProfile(280, 140, 'section')).toBe('section');
    expect(inferPreviewScaleProfile(112, 80, 'section', undefined, 'hero')).toBe('section');
  });
});

describe('resolvePreviewThumbDisplaySize section pin', () => {
  it('uses larger section max box and fillWidth for pinned composites', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 400, 220, {
      pinScope: 'section',
      fullWidth: true,
    });
    expect(display.fillWidth).toBe(true);
    expect(display.maxHeight).toBe(SECTION_PREVIEW_THUMB_MAX.pinned.height);
    expect(display.height).toBe(SECTION_PREVIEW_THUMB_MAX.pinned.height);
    expect(display.width).toBeGreaterThan(PREVIEW_THUMB_MAX.pinned.width);
    expect(display.objectFit).toBe('cover');
  });

  it('uses object-contain for raster section captures', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 400, 240, {
      pinScope: 'section',
      fullWidth: true,
      captureKind: 'raster',
    });
    expect(display.objectFit).toBe('contain');
    expect(display.fillWidth).toBe(true);
  });
});

describe('resolvePreviewThumbDisplaySize heading with section capture', () => {
  it('uses section scale when capture is a wide composite', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 400, 220, {
      elementKind: 'heading',
      pinScope: 'element',
      fullWidth: true,
    });
    expect(display.height).toBe(SECTION_PREVIEW_THUMB_MAX.pinned.height);
    expect(display.width).toBeGreaterThan(48);
    expect(display.fillWidth).toBe(true);
  });
});

describe('resolvePreviewThumbDisplaySize heading', () => {
  it('scales headings larger while preserving aspect ratio', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 320, 48, {
      elementKind: 'heading',
    });
    expect(display.height).toBe(48);
    expect(display.width).toBe(320);
  });
});

describe('resolvePreviewThumbDisplaySize item_card', () => {
  it('scales item cards to readable height', () => {
    const display = resolvePreviewThumbDisplaySize('pinned', 160, 120, {
      elementKind: 'item_card',
    });
    expect(display.height).toBe(76);
    expect(display.width).toBe(Math.round(160 * (76 / 120)));
  });
});

describe('computeDragGhostDimensions', () => {
  it('grows with preview height for wide headings', () => {
    const withPreview = computeDragGhostDimensions(
      {
        kind: 'hero',
        pinScope: 'element',
        elementKind: 'heading',
        previewCaptureWidth: 320,
        previewCaptureHeight: 48,
      },
      { captureWidth: 320, captureHeight: 48, showPreview: true, showBreadcrumb: false }
    );
    const withoutPreview = computeDragGhostDimensions(
      {
        kind: 'hero',
        pinScope: 'element',
        elementKind: 'heading',
      },
      { showPreview: false, showBreadcrumb: false }
    );
    expect(withPreview.ghostHeight).toBeGreaterThan(withoutPreview.ghostHeight);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildElementCaptureBridgeScript,
  isOpaqueCssColor,
  parseBorderRadiusPx,
  pickElementFillColor,
  pickPreviewFrameBackground,
  shouldPreferStyledElementCapture,
  shouldUseButtonStyledCapture,
} from '@/lib/preview/captureTargetPreview';
import {
  fitScaleToBox,
  TARGET_PREVIEW_THUMB_DPR,
  TARGET_PREVIEW_THUMB_HEIGHT,
  TARGET_PREVIEW_THUMB_RENDER_HEIGHT,
  TARGET_PREVIEW_THUMB_RENDER_WIDTH,
  TARGET_PREVIEW_THUMB_WIDTH,
} from '@/lib/preview/targetPreviewThumbnail';

describe('shouldUseButtonStyledCapture', () => {
  it('applies only to links and button leaf kind', () => {
    expect(shouldUseButtonStyledCapture('button', 'DIV')).toBe(true);
    expect(shouldUseButtonStyledCapture(undefined, 'A')).toBe(true);
    expect(shouldUseButtonStyledCapture('contact_field', 'DIV')).toBe(false);
    expect(shouldUseButtonStyledCapture('heading', 'H2')).toBe(false);
  });
});

describe('shouldPreferStyledElementCapture', () => {
  it('prefers styled capture for all element pins', () => {
    expect(shouldPreferStyledElementCapture('item_card', 'element')).toBe(true);
    expect(shouldPreferStyledElementCapture('heading', 'element')).toBe(true);
    expect(shouldPreferStyledElementCapture(undefined, 'section')).toBe(false);
  });
});

describe('pickPreviewFrameBackground', () => {
  it('uses nearest parent background before section', () => {
    expect(
      pickPreviewFrameBackground([
        'transparent',
        'rgb(255, 255, 255)',
        'rgb(127, 45, 18)',
      ])
    ).toBe('rgb(255, 255, 255)');
  });

  it('falls back to section color when parents are transparent', () => {
    expect(
      pickPreviewFrameBackground(['transparent', 'transparent', 'rgb(127, 45, 18)'])
    ).toBe('rgb(127, 45, 18)');
  });
});

describe('parseBorderRadiusPx', () => {
  it('maps pill radii to half height', () => {
    expect(parseBorderRadiusPx('9999px', 40)).toBe(20);
  });
});

describe('pickElementFillColor', () => {
  it('reads solid and gradient snippet colors', () => {
    expect(pickElementFillColor('rgb(234, 88, 12)')).toBe('rgb(234, 88, 12)');
    expect(pickElementFillColor('transparent', 'linear-gradient(rgb(1,2,3), #fff)')).toBe(
      'rgb(1,2,3)'
    );
  });
});

describe('isOpaqueCssColor', () => {
  it('rejects transparent values', () => {
    expect(isOpaqueCssColor('transparent')).toBe(false);
    expect(isOpaqueCssColor('rgb(234, 88, 12)')).toBe(true);
  });
});

describe('fitScaleToBox', () => {
  it('scales large elements down to the fixed thumbnail box', () => {
    const fit = fitScaleToBox(320, 48, TARGET_PREVIEW_THUMB_WIDTH - 16, TARGET_PREVIEW_THUMB_HEIGHT - 16);
    expect(fit.width).toBeLessThanOrEqual(TARGET_PREVIEW_THUMB_WIDTH - 16);
    expect(fit.height).toBeLessThanOrEqual(TARGET_PREVIEW_THUMB_HEIGHT - 16);
    expect(fit.scale).toBeLessThan(1);
  });
});

describe('TARGET_PREVIEW_THUMB_DPR', () => {
  it('renders at 2x resolution for sharper display', () => {
    expect(TARGET_PREVIEW_THUMB_DPR).toBe(2);
    expect(TARGET_PREVIEW_THUMB_RENDER_WIDTH).toBe(TARGET_PREVIEW_THUMB_WIDTH * 2);
    expect(TARGET_PREVIEW_THUMB_RENDER_HEIGHT).toBe(TARGET_PREVIEW_THUMB_HEIGHT * 2);
  });
});

describe('buildElementCaptureBridgeScript', () => {
  it('includes retina thumb canvas and PNG element captures', () => {
    const script = buildElementCaptureBridgeScript();
    expect(script).toContain('function createThumbCanvas');
    expect(script).toContain('function fitFontSize');
    expect(script).toContain('function drawFittedLine');
    expect(script).toContain('PREVIEW_THUMB_RENDER_W');
    expect(script).toContain('image/png');
    expect(script).toContain('resolvePreviewFrameBackground');
    expect(script).toContain('img');
  });
});

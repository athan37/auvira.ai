import { describe, expect, it } from 'vitest';
import {
  buildElementCaptureBridgeScript,
  gradientLineForAngle,
  isOpaqueCssColor,
  isOutlineControlStyle,
  backgroundColorAlpha,
  isMeaningfulBackgroundColor,
  parseBorderRadiusPx,
  parseLinearGradientAngle,
  parseLinearGradientStops,
  pickCssBackgroundColor,
  pickElementFillColor,
  pickPreviewFrameBackground,
  resolveBackgroundFromChain,
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

describe('backgroundColorAlpha', () => {
  it('treats low-alpha glass fills as transparent for parent fallback', () => {
    expect(backgroundColorAlpha('rgba(255, 255, 255, 0.05)')).toBe(0.05);
    expect(isMeaningfulBackgroundColor('rgba(255, 255, 255, 0.05)')).toBe(false);
    expect(pickElementFillColor('rgba(255, 255, 255, 0.05)', 'none')).toBeUndefined();
  });

  it('keeps opaque fills', () => {
    expect(isMeaningfulBackgroundColor('rgb(37, 99, 235)')).toBe(true);
    expect(pickElementFillColor('rgb(37, 99, 235)', 'none')).toBe('rgb(37, 99, 235)');
  });
});

describe('resolveBackgroundFromChain', () => {
  it('uses immediate parent background when element fill is transparent', () => {
    expect(
      resolveBackgroundFromChain([
        { backgroundColor: 'transparent', backgroundImage: 'none' },
        { backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' },
      ])
    ).toEqual({ backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' });
  });

  it('skips glass fills and inherits parent background', () => {
    expect(
      resolveBackgroundFromChain([
        { backgroundColor: 'rgba(255, 255, 255, 0.05)', backgroundImage: 'none' },
        { backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' },
      ])
    ).toEqual({ backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' });
  });

  it('prefers inner card background over section background for headings', () => {
    expect(
      resolveBackgroundFromChain([
        { backgroundColor: 'transparent', backgroundImage: 'none' },
        { backgroundColor: 'transparent', backgroundImage: 'none' },
        { backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' },
        { backgroundColor: 'rgb(220, 38, 38)', backgroundImage: 'none' },
      ])
    ).toEqual({ backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' });
  });

  it('prefers element background when present', () => {
    expect(
      resolveBackgroundFromChain([
        { backgroundColor: 'rgb(254, 243, 199)', backgroundImage: 'none' },
        { backgroundColor: 'rgb(37, 99, 235)', backgroundImage: 'none' },
      ])
    ).toEqual({ backgroundColor: 'rgb(254, 243, 199)', backgroundImage: 'none' });
  });

  it('inherits gradient backgrounds from parent', () => {
    const style = resolveBackgroundFromChain([
      { backgroundColor: 'transparent', backgroundImage: 'none' },
      {
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(rgb(127, 45, 18), rgb(0, 0, 0))',
      },
    ]);
    expect(style?.backgroundImage).toContain('linear-gradient');
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

describe('pickCssBackgroundColor', () => {
  it('reads gradient colors when backgroundColor is transparent', () => {
    expect(
      pickCssBackgroundColor('transparent', 'linear-gradient(rgb(127, 45, 18), rgb(0, 0, 0))')
    ).toBe('rgb(127, 45, 18)');
  });
});

describe('isOutlineControlStyle', () => {
  it('detects border-only buttons', () => {
    expect(
      isOutlineControlStyle({
        backgroundColor: 'transparent',
        borderWidth: '1px',
        borderColor: 'rgb(255, 255, 255)',
      })
    ).toBe(true);
    expect(
      isOutlineControlStyle({
        backgroundColor: 'rgb(234, 88, 12)',
        borderWidth: '0px',
      })
    ).toBe(false);
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

describe('parseLinearGradientStops', () => {
  it('extracts rgb and hex stops from linear-gradient', () => {
    expect(parseLinearGradientStops('none')).toEqual([]);
    expect(
      parseLinearGradientStops('linear-gradient(135deg, rgb(127, 45, 18) 0%, rgb(59, 130, 246) 100%)')
    ).toEqual(['rgb(127, 45, 18)', 'rgb(59, 130, 246)']);
    expect(parseLinearGradientStops('linear-gradient(#fff, #000)')).toEqual(['#fff', '#000']);
  });
});

describe('parseLinearGradientAngle', () => {
  it('reads deg from linear-gradient and defaults to 90', () => {
    expect(parseLinearGradientAngle('none')).toBe(90);
    expect(parseLinearGradientAngle('linear-gradient(135deg, #fff, #000)')).toBe(135);
    expect(parseLinearGradientAngle('linear-gradient(rgb(1,2,3), rgb(4,5,6))')).toBe(90);
  });
});

describe('gradientLineForAngle', () => {
  it('returns distinct endpoints for diagonal gradients', () => {
    const line = gradientLineForAngle(360, 200, 135);
    expect(line.x0).not.toBe(line.x1);
    expect(line.y0).not.toBe(line.y1);
  });
});

describe('buildElementCaptureBridgeScript', () => {
  it('includes styled section and element capture helpers', () => {
    const script = buildElementCaptureBridgeScript();
    expect(script).toContain('function captureSectionStyledPreview');
    expect(script).toContain('function resolveSectionPreviewCanvasSize');
    expect(script).toContain('function parseLinearGradientAngle');
    expect(script).toContain('function previewCardRadiusPx');
    expect(script).toContain('function paintCanvasBackground');
    expect(script).toContain('function createScaledCanvas');
    expect(script).not.toContain('var w=280,h=140');
    expect(script).toContain('function fitFontSize');
    expect(script).toContain('function drawFittedLine');
    expect(script).toContain('PREVIEW_THUMB_RENDER_W');
    expect(script).toContain('image/png');
    expect(script).not.toContain('function createThumbCanvas');
    expect(script).toContain('resolvePreviewFrameBackground');
    expect(script).toContain('measureButtonPaintSize');
    expect(script).toContain('ctx.fillText(label,cx,cy);');
    expect(script).toContain('paintElementBackdrop(ctx,el,outW,outH)');
    expect(script).toContain('resolveImmediateBackgroundStyle(el,null)');
    expect(script).not.toMatch(/paintElementBackdrop[\s\S]*resolveSectionComputedStyle/);
    expect(script).not.toMatch(/paintElementBackdrop\(ctx,outW,outH,el\)/);
  });
});

import { describe, expect, it } from 'vitest';
import { formatPreviewTargetPrimaryLabel } from '@/lib/preview/previewTargetChipLabels';
import {
  buildElementCaptureBridgeScript,
  parseLinearGradientAngle,
  parseLinearGradientStops,
} from '@/lib/preview/captureTargetPreview';
import {
  PREVIEW_SECTION_BRIDGE_VERSION,
  buildSectionBridgeScriptBody,
} from '@/lib/preview/sectionBridgeScript';
import {
  inferPreviewScaleProfile,
  resolvePreviewThumbDisplaySize,
} from '@/lib/preview/targetPreviewThumbnail';

describe('inner card gradient preview regression', () => {
  it('uses bridge v54+ with inner-card-first capture and backdrop split', () => {
    expect(PREVIEW_SECTION_BRIDGE_VERSION).toBeGreaterThanOrEqual(54);
    const bridge = buildSectionBridgeScriptBody();
    expect(bridge).toContain('function resolveBackdropBackgroundStyle');
    expect(bridge).toContain('captureCardStyledFallback(innerCard)');
    expect(bridge).toContain('pinnedInnerCard&&(!inferred.fieldPath||inferred.kind==="item_card")');
    expect(bridge).toContain('shouldUseInnerCardPreviewCapture(payload,dragState.el,dragState.target)');
  });

  it('paints card gradients via fillRoundedRectWithStyle, not section backdrop bleed', () => {
    const script = buildElementCaptureBridgeScript();
    expect(script).toContain('function fillRoundedRectWithStyle');
    const cardFn = script.match(/function captureCardStyledFallback[\s\S]*?return thumbResult/)?.[0] ?? '';
    expect(cardFn).toContain('fillRoundedRectWithStyle(ctx,edgePad,edgePad,cardW,cardH,radius,style,"#ffffff")');
    expect(cardFn).not.toContain('paintElementBackdrop(ctx,el,outW,outH)');
  });

  it('parses Tailwind to-right gradient syntax', () => {
    const image =
      'linear-gradient(to right, rgb(120, 53, 15), rgb(22, 163, 74))';
    expect(parseLinearGradientAngle(image)).toBe(90);
    expect(parseLinearGradientStops(image)).toEqual(['rgb(120, 53, 15)', 'rgb(22, 163, 74)']);
  });

  it('labels inner card container pins as Contact card, not concatenated card text', () => {
    const label = formatPreviewTargetPrimaryLabel({
      kind: 'section',
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      pinScope: 'section',
      targetChain: [
        { role: 'section', label: 'Get Started Today', kind: 'contact' },
        { role: 'container', label: 'Contact card', kind: 'inner_card' },
      ],
    });
    expect(label).toBe('Contact card');
  });

  it('displays inner card captures at element scale with contain layout', () => {
    expect(inferPreviewScaleProfile(228, 208, 'section', undefined, 'contact', 'inner_card')).toBe(
      'element'
    );
    const display = resolvePreviewThumbDisplaySize('pinned', 228, 208, {
      pinScope: 'section',
      fullWidth: true,
      leafContainerKind: 'inner_card',
      captureKind: 'styled_fallback',
    });
    expect(display.fillWidth).toBeUndefined();
    expect(display.objectFit).toBeUndefined();
    expect(display.height).toBe(76);
  });
});

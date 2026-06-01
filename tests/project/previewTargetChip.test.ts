import { describe, expect, it, vi } from 'vitest';
import {
  formatPreviewTargetChipText,
  formatPreviewTargetLabel,
} from '@/lib/preview/previewTargetChipLabels';
import {
  activatePreviewTargetChip,
  handlePreviewTargetChipKeyDown,
} from '@/lib/preview/previewTargetChipInteractions';
import {
  dismissPreviewTargetHint,
  isPreviewTargetHintDismissed,
  PREVIEW_TARGET_HINT_STORAGE_KEY,
  shouldShowPreviewTargetHint,
} from '@/lib/preview/previewTargetHintStorage';

const heroTarget = {
  kind: 'hero' as const,
  sectionId: 'hero',
  sectionType: 'hero',
  sectionTitle: 'Hero',
};

const ctaTarget = {
  kind: 'section' as const,
  sectionId: 'section_cta_cta_1',
  sectionType: 'CTA',
  sectionTitle: 'Book Now',
};

describe('previewTargetChipLabels', () => {
  it('formats hero and typed section labels', () => {
    expect(formatPreviewTargetLabel(heroTarget)).toBe('Hero');
    expect(formatPreviewTargetLabel(ctaTarget)).toBe('CTA: Book Now');
  });

  it('renders pinned and used chip labels with unified copy', () => {
    expect(formatPreviewTargetChipText(heroTarget, 'pinned')).toBe('Pinned: Hero');
    expect(formatPreviewTargetChipText(ctaTarget, 'used')).toBe('Used: CTA: Book Now');
  });
});

describe('previewTargetChipInteractions', () => {
  it('calls preview focus handler and refocuses chat input on activate', () => {
    const onActivate = vi.fn();
    const refocusInput = vi.fn();
    activatePreviewTargetChip({ onActivate, refocusInput });
    expect(onActivate).toHaveBeenCalledOnce();
    expect(refocusInput).toHaveBeenCalledOnce();
  });

  it('supports keyboard activation with Enter and Space', () => {
    const onActivate = vi.fn();
    const refocusInput = vi.fn();
    const preventDefault = vi.fn();

    handlePreviewTargetChipKeyDown({ key: 'Enter', preventDefault }, onActivate, refocusInput);
    handlePreviewTargetChipKeyDown({ key: ' ', preventDefault }, onActivate, refocusInput);

    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(refocusInput).toHaveBeenCalledTimes(2);
  });

  it('ignores unrelated keys', () => {
    const onActivate = vi.fn();
    handlePreviewTargetChipKeyDown({ key: 'Escape', preventDefault: vi.fn() }, onActivate);
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('previewTargetHintStorage', () => {
  it('shows first-run hint only for editable targeting without a pin', () => {
    expect(
      shouldShowPreviewTargetHint({
        previewReady: true,
        previewTargetingAvailable: true,
        hasSelectedTarget: false,
        dismissed: false,
      })
    ).toBe(true);
  });

  it('hides hint after target selected or dismissed', () => {
    expect(
      shouldShowPreviewTargetHint({
        previewReady: true,
        previewTargetingAvailable: true,
        hasSelectedTarget: true,
        dismissed: false,
      })
    ).toBe(false);
    expect(
      shouldShowPreviewTargetHint({
        previewReady: true,
        previewTargetingAvailable: true,
        hasSelectedTarget: false,
        dismissed: true,
      })
    ).toBe(false);
  });

  it('does not show hint for live or unavailable preview targeting', () => {
    expect(
      shouldShowPreviewTargetHint({
        previewReady: true,
        previewTargetingAvailable: false,
        hasSelectedTarget: false,
        dismissed: false,
      })
    ).toBe(false);
  });

  it('persists dismissal in localStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    expect(isPreviewTargetHintDismissed()).toBe(false);
    dismissPreviewTargetHint();
    expect(store.get(PREVIEW_TARGET_HINT_STORAGE_KEY)).toBe('1');
    expect(isPreviewTargetHintDismissed()).toBe(true);

    vi.unstubAllGlobals();
  });
});

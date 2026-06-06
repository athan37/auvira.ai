import { describe, expect, it, vi } from 'vitest';
import {
  formatPreviewTargetBreadcrumb,
  formatPreviewTargetChipText,
  formatPreviewTargetCompactBreadcrumb,
  formatPreviewTargetDisplay,
  formatPreviewTargetLabel,
  formatPreviewTargetLayers,
  formatPreviewTargetPrimaryLabel,
  shouldShowTargetBreadcrumb,
} from '@/lib/preview/previewTargetChipLabels';
import { targetPreviewDisplayUrl } from '@/lib/preview/targetPreviewThumbnail';
import { sectionTypeLabel } from '@/lib/preview/previewTargetVisuals';
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

  it('formats field-level labels when fieldPath is pinned', () => {
    expect(
      formatPreviewTargetLabel({
        ...ctaTarget,
        fieldPath: 'sections[2].title',
      })
    ).toBe('CTA: Book Now › title');
  });

  it('splits parent and nested child layers for element pins', () => {
    expect(
      formatPreviewTargetLayers({
        kind: 'section',
        sectionId: 'section_contact_1',
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        elementLabel: 'Phone button',
      })
    ).toEqual({
      parent: 'contact: Get Started Today',
      children: ['Phone button'],
    });
  });

  it('formatPreviewTargetDisplay splits scope badge, title, and element', () => {
    expect(
      formatPreviewTargetDisplay({
        kind: 'section',
        sectionId: 'section_contact_1',
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        elementKind: 'button',
        elementLabel: 'Phone button',
      })
    ).toEqual({
      scopeLabel: 'Contact',
      title: 'Get Started Today',
      element: { kind: 'button', label: 'Phone button' },
      chainRows: [],
    });
  });

  it('formatPreviewTargetBreadcrumb joins scope, title, and element', () => {
    expect(
      formatPreviewTargetBreadcrumb({
        kind: 'section',
        sectionId: 'section_contact_1',
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        elementLabel: 'Phone button',
      })
    ).toBe('Contact · Get Started Today › Phone button');
  });

  it('formatPreviewTargetChain renders hierarchical rows with item position', () => {
    const target = {
      kind: 'section' as const,
      sectionType: 'services',
      sectionTitle: 'Our Services',
      sectionIndex: 1,
      targetChain: [
        { role: 'section' as const, label: 'Our Services', kind: 'services' },
        { role: 'container' as const, label: 'Service cards', kind: 'item_grid' },
        { role: 'item' as const, label: 'Item 3', itemIndex: 2, itemPosition: 3 },
        {
          role: 'element' as const,
          label: 'Service card description',
          kind: 'item_body',
          fieldPath: 'sections[1].items[2].description',
        },
      ],
      fieldPath: 'sections[1].items[2].description',
      pinScope: 'element' as const,
    };
    expect(formatPreviewTargetBreadcrumb(target)).toBe(
      'Services · Our Services › Service cards › Item 3 › Service card description'
    );
  });

  it('targetPreviewDisplayUrl prefers uploaded preview URL over transient data URL', () => {
    expect(
      targetPreviewDisplayUrl({
        previewThumbnail: { previewUrl: '/api/preview.jpg' },
        previewThumbnailDataUrl: 'data:image/jpeg;base64,tmp',
      })
    ).toBe('/api/preview.jpg');
    expect(
      targetPreviewDisplayUrl({
        previewThumbnailDataUrl: 'data:image/jpeg;base64,tmp',
      })
    ).toBe('data:image/jpeg;base64,tmp');
  });

  it('sectionTypeLabel title-cases known section types', () => {
    expect(sectionTypeLabel('contact')).toBe('Contact');
    expect(sectionTypeLabel('faq')).toBe('FAQ');
    expect(sectionTypeLabel('hero')).toBe('Hero');
  });

  it('renders pinned and used chip labels with unified copy', () => {
    expect(formatPreviewTargetChipText(heroTarget, 'pinned')).toBe('Pinned: Hero');
    expect(formatPreviewTargetChipText(ctaTarget, 'used')).toBe('Used: CTA: Book Now');
  });

  it('formats delivery coverage item card pin without generic Item cards label', () => {
    const target = {
      kind: 'section' as const,
      sectionId: 'section_generic_delivery-coverage_5',
      sectionType: 'generic',
      sectionTitle: 'Delivery Coverage',
      sectionIndex: 4,
      fieldPath: 'sections[4].items[2].title',
      elementKind: 'item_card',
      elementLabel: 'Include minimum order requirements if any',
      itemIndex: 2,
      pinScope: 'element' as const,
      targetChain: [
        { role: 'section' as const, label: 'Delivery Coverage', kind: 'generic' },
        { role: 'item' as const, label: 'Item 3', itemIndex: 2, itemPosition: 3 },
        {
          role: 'element' as const,
          kind: 'item_card',
          label: 'Include minimum order requirements if any',
          fieldPath: 'sections[4].items[2].title',
          itemIndex: 2,
        },
      ],
    };
    const display = formatPreviewTargetDisplay(target);
    expect(display.title).toBe('Delivery Coverage');
    expect(display.chainRows?.map((row) => row.label)).toEqual([
      'Item 3',
      'Include minimum order requirements if any',
    ]);
    expect(formatPreviewTargetLabel(target)).toBe(
      'generic: Delivery Coverage › Item 3 › Include minimum order requirements if any'
    );
  });

  it('formatPreviewTargetPrimaryLabel prefers leaf chain label over section title', () => {
    expect(
      formatPreviewTargetPrimaryLabel({
        kind: 'hero',
        sectionTitle: 'Hero',
        elementKind: 'heading',
        elementLabel: 'Beverage & Food Delivery for Your Business',
        pinScope: 'element',
        targetChain: [
          { role: 'section', label: 'Hero', kind: 'hero' },
          {
            role: 'element',
            kind: 'heading',
            label: 'Beverage & Food Delivery for Your Business',
          },
        ],
      })
    ).toBe('Beverage & Food Delivery for Your Business');
  });

  it('shouldShowTargetBreadcrumb shows element path for single-level element pins', () => {
    expect(
      shouldShowTargetBreadcrumb({
        kind: 'hero',
        elementKind: 'heading',
        elementLabel: 'Beverage & Food Delivery for Your Business',
        pinScope: 'element',
        targetChain: [
          { role: 'section', label: 'Hero', kind: 'hero' },
          {
            role: 'element',
            kind: 'heading',
            label: 'Beverage & Food Delivery for Your Business',
          },
        ],
      })
    ).toBe(true);
    expect(
      formatPreviewTargetCompactBreadcrumb({
        kind: 'hero',
        elementKind: 'button',
        elementLabel: 'Learn About Our Services',
        pinScope: 'element',
        targetChain: [
          { role: 'section', label: 'Hero', kind: 'hero' },
          { role: 'element', kind: 'button', label: 'Learn About Our Services' },
        ],
      })
    ).toBe('Hero › Button');
  });

  it('formatPreviewTargetCompactBreadcrumb keeps intermediate chain labels', () => {
    expect(
      formatPreviewTargetCompactBreadcrumb({
        kind: 'section',
        sectionType: 'services',
        sectionTitle: 'Our Services',
        targetChain: [
          { role: 'section', label: 'Our Services' },
          { role: 'container', label: 'Service cards', kind: 'item_grid' },
          { role: 'item', label: 'Item 3', itemIndex: 2 },
          { role: 'element', kind: 'item_body', label: 'Fast response times' },
        ],
      })
    ).toBe('Our Services › Service cards › Item 3');
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

import { describe, expect, it } from 'vitest';
import {
  resolveCaptureRoot,
  resolvePreviewCaptureRoot,
  resolveSectionCaptureClip,
  shouldCaptureFullSectionPreview,
} from '@/lib/preview/capturePreviewRoot';

interface MockElement {
  tagName?: string;
  getAttribute(name: string): string | null;
  parentElement: MockElement | null;
  getBoundingClientRect(): DOMRect;
}

function mockEl(
  attrs: Record<string, string> = {},
  parent: MockElement | null = null,
  rect: Partial<DOMRect> = { width: 100, height: 40 },
  tagName = 'DIV',
): MockElement {
  return {
    tagName,
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    parentElement: parent,
    getBoundingClientRect() {
      return {
        width: rect.width ?? 100,
        height: rect.height ?? 40,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 40,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
}

describe('resolveCaptureRoot', () => {
  it('returns section element for section-only pin', () => {
    const section = mockEl({ 'data-site-section-id': 'services' }, null, { width: 900, height: 400 }, 'SECTION');
    const title = mockEl({}, section);
    const root = resolveCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: title as unknown as Element,
      pinScope: 'section',
    });
    expect(root).toBe(section);
  });

  it('returns item card wrapper for item body pin', () => {
    const section = mockEl({ 'data-site-section-id': 'services' }, null, { width: 900, height: 400 }, 'SECTION');
    const card = mockEl({ class: 'rounded-3xl border p-7' }, section);
    const body = mockEl(
      {
        'data-site-element-kind': 'item_body',
        'data-site-config-field-path': 'sections[1].items[2].description',
        'data-site-item-index': '2',
      },
      card,
    );

    const root = resolveCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: body as unknown as Element,
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Services' },
        { role: 'item', label: 'Item 3', itemIndex: 2 },
        {
          role: 'element',
          kind: 'item_body',
          label: 'Description',
          fieldPath: 'sections[1].items[2].description',
        },
      ],
    });

    expect(root).toBe(card);
  });

  it('returns item card element for item_card pin', () => {
    const section = mockEl({ 'data-site-section-id': 'delivery' }, null, { width: 900, height: 400 }, 'SECTION');
    const card = mockEl(
      {
        class: 'rounded-3xl border p-7',
        'data-site-element-kind': 'item_card',
        'data-site-element-label': 'Include minimum order requirements if any',
      },
      section,
    );

    const root = resolveCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: card as unknown as Element,
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Delivery Coverage' },
        { role: 'item', label: 'Item 3', itemIndex: 2 },
        {
          role: 'element',
          kind: 'item_card',
          label: 'Include minimum order requirements if any',
          fieldPath: 'sections[4].items[2].title',
        },
      ],
    });

    expect(root).toBe(card);
  });

  it('returns annotated leaf for button pin', () => {
    const section = mockEl({ 'data-site-section-id': 'contact' }, null, { width: 900, height: 400 }, 'SECTION');
    const button = mockEl(
      {
        'data-site-element-kind': 'button',
        'data-site-config-field-path': 'contact.phone',
        'data-site-surface-id': 'contact-phone-button',
      },
      section,
    );

    const root = resolveCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: button as unknown as Element,
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Contact' },
        { role: 'element', kind: 'button', label: 'Phone button', fieldPath: 'contact.phone' },
      ],
    });

    expect(root).toBe(button);
  });
});

describe('resolvePreviewCaptureRoot', () => {
  it('promotes section title element pin to full section preview', () => {
    const section = mockEl(
      { 'data-site-section-id': 'contact', 'data-site-section-type': 'contact' },
      null,
      { width: 960, height: 420 },
      'SECTION',
    );
    const heading = mockEl(
      {
        'data-site-element-kind': 'heading',
        'data-site-config-field-path': 'sections[4].title',
      },
      section,
    );

    expect(
      shouldCaptureFullSectionPreview({
        sectionEl: section as unknown as Element,
        clickTarget: heading as unknown as Element,
        pinScope: 'element',
        targetChain: [
          { role: 'section', label: 'Get Started Today' },
          { role: 'element', kind: 'heading', label: 'Get Started Today', fieldPath: 'sections[4].title' },
        ],
      })
    ).toBe(true);

    const root = resolvePreviewCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: heading as unknown as Element,
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Get Started Today' },
        { role: 'element', kind: 'heading', label: 'Get Started Today', fieldPath: 'sections[4].title' },
      ],
    });
    expect(root).toBe(section);
  });

  it('keeps button pins on the leaf element', () => {
    const section = mockEl({ 'data-site-section-id': 'contact' }, null, { width: 960, height: 420 }, 'SECTION');
    const button = mockEl(
      {
        'data-site-element-kind': 'button',
        'data-site-config-field-path': 'hero.primaryCta',
      },
      section,
    );

    const root = resolvePreviewCaptureRoot({
      sectionEl: section as unknown as Element,
      clickTarget: button as unknown as Element,
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Get Started Today' },
        { role: 'element', kind: 'button', label: 'Get in Touch', fieldPath: 'hero.primaryCta' },
      ],
    });
    expect(root).toBe(button);
  });
});

describe('resolveSectionCaptureClip', () => {
  it('clips tall sections to a fixed preview height', () => {
    const section = mockEl(
      { 'data-site-section-id': 'contact' },
      null,
      { width: 960, height: 420, top: 0 },
      'SECTION',
    );
    const click = mockEl({}, section, { width: 200, height: 40, top: 180 });
    const clip = resolveSectionCaptureClip(section as unknown as Element, click as unknown as Element);
    expect(clip.width).toBe(560);
    expect(clip.height).toBe(220);
    expect(clip.offsetY).toBeGreaterThanOrEqual(0);
  });
});

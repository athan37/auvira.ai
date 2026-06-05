import { describe, expect, it } from 'vitest';
import {
  parseSiteSectionDragStartMessage,
  parseSiteSectionPointerDownMessage,
  parseSiteSectionPreviewThumbMessage,
  selectedSectionFromPayload,
} from '@/lib/preview/sectionSelectionProtocol';

describe('sectionSelectionProtocol element pin', () => {
  it('parses element fields on drag start', () => {
    const msg = parseSiteSectionDragStartMessage({
      type: 'SITE_SECTION_DRAG_START',
      payload: {
        sectionId: 'contact-1',
        sectionIndex: 4,
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        clientX: 10,
        clientY: 20,
        elementKind: 'heading',
        elementLabel: 'Contact Information',
        fieldPath: 'sections[4].subtitle',
      },
    });
    expect(msg?.payload.fieldPath).toBe('sections[4].subtitle');
    expect(msg?.payload.elementKind).toBe('heading');
    const section = selectedSectionFromPayload(msg!.payload);
    expect(section.fieldPath).toBe('sections[4].subtitle');
    expect(section.elementLabel).toBe('Contact Information');
  });

  it('parses element fields on pointer down', () => {
    const msg = parseSiteSectionPointerDownMessage({
      type: 'SITE_SECTION_POINTER_DOWN',
      payload: {
        sectionId: 'contact-1',
        sectionIndex: 0,
        sectionType: 'contact',
        sectionTitle: 'Get Started Today',
        clientX: 10,
        clientY: 20,
        elementKind: 'button',
        elementLabel: 'Primary button',
        fieldPath: 'hero.primaryCta',
      },
    });
    expect(msg?.payload.fieldPath).toBe('hero.primaryCta');
    expect(msg?.payload.elementKind).toBe('button');
  });

  it('round-trips targetChain and pinScope', () => {
    const chain = [
      { role: 'section' as const, label: 'Our Services', kind: 'services' },
      { role: 'container' as const, label: 'Service cards', kind: 'item_grid' },
      {
        role: 'item' as const,
        label: 'Item 3',
        itemIndex: 2,
        itemPosition: 3,
      },
      {
        role: 'element' as const,
        label: 'Service card description',
        kind: 'item_body',
        fieldPath: 'sections[1].items[2].description',
        itemIndex: 2,
        itemPosition: 3,
        surfaceId: 'sections-1-items-2-description',
      },
    ];
    const msg = parseSiteSectionDragStartMessage({
      type: 'SITE_SECTION_DRAG_START',
      payload: {
        sectionId: 'services-1',
        sectionIndex: 1,
        sectionType: 'services',
        sectionTitle: 'Our Services',
        clientX: 1,
        clientY: 2,
        fieldPath: 'sections[1].items[2].description',
        elementKind: 'item_body',
        elementLabel: 'Service card description',
        itemIndex: 2,
        surfaceId: 'sections-1-items-2-description',
        pinScope: 'element',
        targetChain: chain,
      },
    });
    expect(msg?.payload.targetChain).toEqual(chain);
    expect(msg?.payload.pinScope).toBe('element');
    const section = selectedSectionFromPayload(msg!.payload);
    expect(section.targetChain).toEqual(chain);
    expect(section.pinScope).toBe('element');
  });

  it('parses preview thumb message from iframe', () => {
    const msg = parseSiteSectionPreviewThumbMessage({
      type: 'SITE_SECTION_PREVIEW_THUMB',
      payload: {
        sectionId: 'contact-1',
        surfaceId: 'contact-phone-button',
        dataUrl: 'data:image/jpeg;base64,abc',
        captureKind: 'raster',
        width: 120,
        height: 48,
      },
    });
    expect(msg?.payload.sectionId).toBe('contact-1');
    expect(msg?.payload.surfaceId).toBe('contact-phone-button');
    expect(msg?.payload.captureKind).toBe('raster');
  });

  it('parses fieldPath on preview thumb messages', () => {
    const msg = parseSiteSectionPreviewThumbMessage({
      type: 'SITE_SECTION_PREVIEW_THUMB',
      payload: {
        sectionId: 'hero',
        fieldPath: 'contact.email',
        dataUrl: 'data:image/png;base64,abc',
        captureKind: 'styled_fallback',
        width: 112,
        height: 80,
      },
    });
    expect(msg?.payload.fieldPath).toBe('contact.email');
  });

  it('parses nav CTA drag payload with hero.primaryCta field path', () => {
    const msg = parseSiteSectionDragStartMessage({
      type: 'SITE_SECTION_DRAG_START',
      payload: {
        sectionId: 'nav',
        sectionIndex: -1,
        sectionType: 'nav',
        sectionTitle: 'Navigation',
        clientX: 5,
        clientY: 10,
        elementKind: 'button',
        elementLabel: 'Get in Touch',
        fieldPath: 'hero.primaryCta',
        pinScope: 'element',
        targetChain: [
          { role: 'section', kind: 'nav', label: 'Navigation' },
          {
            role: 'element',
            kind: 'button',
            label: 'Get in Touch',
            fieldPath: 'hero.primaryCta',
          },
        ],
      },
    });
    expect(msg?.payload.sectionType).toBe('nav');
    expect(msg?.payload.fieldPath).toBe('hero.primaryCta');
    const section = selectedSectionFromPayload(msg!.payload);
    expect(section.kind).toBe('section');
    expect(section.elementLabel).toBe('Get in Touch');
  });

  it('round-trips item_card element pin for generic section cards', () => {
    const chain = [
      { role: 'section' as const, label: 'Delivery Coverage', kind: 'generic' },
      { role: 'item' as const, label: 'Item 3', itemIndex: 2, itemPosition: 3 },
      {
        role: 'element' as const,
        label: 'Include minimum order requirements if any',
        kind: 'item_card',
        fieldPath: 'sections[4].items[2].title',
        itemIndex: 2,
        itemPosition: 3,
        surfaceId: 'sections-4-items-2-title',
      },
    ];
    const msg = parseSiteSectionDragStartMessage({
      type: 'SITE_SECTION_DRAG_START',
      payload: {
        sectionId: 'section_generic_delivery-coverage_5',
        sectionIndex: 4,
        sectionType: 'generic',
        sectionTitle: 'Delivery Coverage',
        clientX: 1,
        clientY: 2,
        fieldPath: 'sections[4].items[2].title',
        elementKind: 'item_card',
        elementLabel: 'Include minimum order requirements if any',
        itemIndex: 2,
        surfaceId: 'sections-4-items-2-title',
        pinScope: 'element',
        targetChain: chain,
      },
    });
    expect(msg?.payload.elementKind).toBe('item_card');
    expect(msg?.payload.elementLabel).toBe('Include minimum order requirements if any');
    expect(msg?.payload.pinScope).toBe('element');
    const section = selectedSectionFromPayload(msg!.payload);
    expect(section.targetChain?.at(-1)?.label).toBe('Include minimum order requirements if any');
  });
});

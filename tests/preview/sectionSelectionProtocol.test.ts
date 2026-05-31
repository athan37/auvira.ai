import { describe, expect, it } from 'vitest';
import {
  buildSiteSectionClearMessage,
  buildSiteSectionFocusMessage,
  buildSiteSectionHighlightMessage,
  isValidParentToIframeSectionMessage,
  parseSiteSectionDragStartMessage,
  parseSiteSectionSelectedMessage,
  selectedSectionFromPayload,
  PREVIEW_SECTION_MSG,
} from '@/lib/preview/sectionSelectionProtocol';

describe('sectionSelectionProtocol', () => {
  it('parses valid SITE_SECTION_SELECTED', () => {
    const parsed = parseSiteSectionSelectedMessage({
      type: PREVIEW_SECTION_MSG.SELECTED,
      payload: {
        sectionId: 'section_contact_contact_1',
        sectionIndex: 2,
        sectionType: 'contact',
        sectionTitle: 'Contact',
      },
    });
    expect(parsed?.payload.sectionId).toBe('section_contact_contact_1');
    expect(selectedSectionFromPayload(parsed!.payload).kind).toBe('section');
  });

  it('ignores malformed payloads', () => {
    expect(parseSiteSectionSelectedMessage({ type: PREVIEW_SECTION_MSG.SELECTED, payload: {} })).toBeNull();
    expect(parseSiteSectionSelectedMessage({ type: 'unknown', payload: {} })).toBeNull();
  });

  it('parses valid SITE_SECTION_DRAG_START with coordinates', () => {
    const parsed = parseSiteSectionDragStartMessage({
      type: PREVIEW_SECTION_MSG.DRAG_START,
      payload: {
        sectionId: 'section_services_services_1',
        sectionIndex: 0,
        sectionType: 'services',
        sectionTitle: 'Services',
        clientX: 120,
        clientY: 240,
      },
    });
    expect(parsed?.payload.clientX).toBe(120);
    expect(parsed?.payload.clientY).toBe(240);
    expect(selectedSectionFromPayload(parsed!.payload).sectionType).toBe('services');
  });

  it('parses hero drag-start payloads', () => {
    const parsed = parseSiteSectionDragStartMessage({
      type: PREVIEW_SECTION_MSG.DRAG_START,
      payload: {
        sectionId: 'section_hero_hero_1',
        sectionIndex: -1,
        sectionType: 'hero',
        sectionTitle: 'Hero',
        clientX: 80,
        clientY: 160,
      },
    });
    expect(parsed?.type).toBe(PREVIEW_SECTION_MSG.DRAG_START);
    expect(selectedSectionFromPayload(parsed!.payload).kind).toBe('hero');
  });

  it('builds highlight, focus, and clear messages', () => {
    expect(buildSiteSectionHighlightMessage('hero')).toEqual({
      type: PREVIEW_SECTION_MSG.HIGHLIGHT,
      payload: { sectionId: 'hero' },
    });
    expect(buildSiteSectionFocusMessage('services')).toEqual({
      type: PREVIEW_SECTION_MSG.FOCUS,
      payload: { sectionId: 'services' },
    });
    expect(buildSiteSectionClearMessage()).toEqual({ type: PREVIEW_SECTION_MSG.CLEAR });
  });

  it('validates FOCUS parent messages', () => {
    expect(
      isValidParentToIframeSectionMessage({
        type: PREVIEW_SECTION_MSG.FOCUS,
        payload: { sectionId: 'hero' },
      })
    ).toBe(true);
    expect(
      isValidParentToIframeSectionMessage({
        type: PREVIEW_SECTION_MSG.FOCUS,
        payload: { sectionId: '' },
      })
    ).toBe(false);
  });
});

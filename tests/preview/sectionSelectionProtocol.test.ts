import { describe, expect, it } from 'vitest';
import {
  parseSiteSectionDragStartMessage,
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
});

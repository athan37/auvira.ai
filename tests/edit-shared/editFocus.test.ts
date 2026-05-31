import { describe, expect, it } from 'vitest';
import {
  buildEditFocusStackAfterEdit,
  editFocusFromLastGalleryEdit,
  lastGalleryEditFromFocusStack,
  normalizeEditFocusStack,
  pushEditFocus,
  sectionIndexFromFocusStack,
  EDIT_FOCUS_STACK_CAP,
} from '@/lib/project-workspace/edit-shared/editFocus';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';

describe('editFocus', () => {
  const galleryFocus = editFocusFromLastGalleryEdit({
    sectionIndex: 2,
    title: 'Winter Portfolio',
    imageUrls: ['/uploads/a.png'],
    imageCount: 1,
  });

  it('pushEditFocus keeps newest first and caps stack', () => {
    let stack = pushEditFocus(null, galleryFocus);
    for (let i = 0; i < EDIT_FOCUS_STACK_CAP + 2; i++) {
      stack = pushEditFocus(stack, {
        ...galleryFocus,
        sectionIndex: i,
        sectionTitle: `Section ${i}`,
        at: new Date().toISOString(),
      });
    }
    expect(stack.items).toHaveLength(EDIT_FOCUS_STACK_CAP);
    expect(stack.items[0]!.sectionIndex).toBe(EDIT_FOCUS_STACK_CAP + 1);
  });

  it('lastGalleryEditFromFocusStack reads gallery kinds', () => {
    const stack = pushEditFocus(null, galleryFocus);
    expect(lastGalleryEditFromFocusStack(stack)).toEqual({
      sectionIndex: 2,
      title: 'Winter Portfolio',
      imageUrls: ['/uploads/a.png'],
      imageCount: 1,
    });
  });

  it('sectionIndexFromFocusStack prefers gallery focus', () => {
    const stack = pushEditFocus(
      { items: [{ ...galleryFocus, kind: 'section_style', sectionIndex: 5, sectionTitle: 'FAQ' }] },
      galleryFocus
    );
    expect(sectionIndexFromFocusStack(stack)).toBe(2);
  });

  it('buildEditFocusStackAfterEdit pushes from agent result', () => {
    const result: WebsiteEditAgentResult = {
      ok: true,
      strategy: 'gallery_captions',
      lastGalleryEdit: {
        sectionIndex: 3,
        title: 'Showcase',
        imageUrls: ['/uploads/x.png'],
        imageCount: 1,
      },
    };
    const stack = buildEditFocusStackAfterEdit({ priorStack: null, result, editJobId: 'job-1' });
    expect(stack.items[0]!.kind).toBe('gallery_captions');
    expect(stack.items[0]!.editJobId).toBe('job-1');
  });

  it('normalizeEditFocusStack validates stored metadata', () => {
    expect(normalizeEditFocusStack({ items: [{ foo: 1 }] })).toBeNull();
    expect(normalizeEditFocusStack({ items: [galleryFocus] })?.items).toHaveLength(1);
  });
});

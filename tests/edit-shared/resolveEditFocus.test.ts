import { describe, expect, it } from 'vitest';
import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { editFocusFromLastGalleryEdit } from '@/lib/project-workspace/edit-shared/editFocus';
import {
  enrichMessageWithEditFocus,
  resolveDeicticTargetFromFocus,
} from '@/lib/project-workspace/edit-shared/resolveEditFocus';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';

const siteConfig = `export const siteConfig = {
  businessName: 'Test',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Services', body: 'Body', items: [] },
    {
      type: 'gallery',
      title: 'New Gallery',
      body: 'Body',
      items: [{ title: 'A', imageUrl: '/uploads/a.png' }],
    },
  ],
};`;

const pageContent = `export default function Page() { return null; }`;

describe('resolveEditFocus', () => {
  const catalog = buildSiteSectionCatalog(siteConfig, pageContent);
  const stack = {
    items: [
      editFocusFromLastGalleryEdit({
        sectionIndex: 1,
        title: 'New Gallery',
        imageUrls: ['/uploads/a.png'],
        imageCount: 1,
      }),
    ],
  };

  it('resolveDeicticTargetFromFocus resolves style on that section', () => {
    const target = resolveDeicticTargetFromFocus(
      'change background of that section to blue-green gradient',
      stack,
      catalog
    );
    expect(target?.needsClarification).toBe(false);
    expect(target?.sectionIndex).toBe(1);
    expect(target?.confidence).toBe('high');
  });

  it('resolveDeicticTargetFromFocus resolves caption on that image', () => {
    const target = resolveDeicticTargetFromFocus(
      'add some description to that image',
      stack,
      catalog
    );
    expect(target?.sectionIndex).toBe(1);
    expect(target?.needsClarification).toBe(false);
  });

  it('enrichMessageWithEditFocus appends structured target hint', () => {
    const enriched = enrichMessageWithEditFocus('add captions to that image', stack);
    expect(enriched).toMatch(/section index 1/i);
    expect(enriched).toMatch(/New Gallery/);
  });

  it('resolveEffectiveEditMessage uses focus stack before legacy merge', () => {
    const effective = resolveEffectiveEditMessage(
      'change background of that section to gradient',
      [],
      stack
    );
    expect(effective).toMatch(/section index 1/i);
  });

  it('3-turn chain: caption focus still allows style on that section', () => {
    const captionStack = {
      items: [
        {
          ...stack.items[0]!,
          kind: 'gallery_captions' as const,
        },
      ],
    };
    const styleTarget = resolveDeicticTargetFromFocus(
      'change background of that section to blue-green gradient',
      captionStack,
      catalog
    );
    expect(styleTarget?.sectionIndex).toBe(1);
  });
});

import path from 'path';
import { promises as fs } from 'fs';
import {
  buildEditFocusStackAfterEdit,
  editFocusFromLastGalleryEdit,
} from '@/lib/project-workspace/edit-shared/editFocus';
import type { ConversationTurn, EditFocusStack, WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';

export const MULTI_TURN_IMAGE_USER = 'add this image to a new section';
export const MULTI_TURN_IMAGE_ASSISTANT =
  'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.';
export const MULTI_TURN_CAPTION_USER = 'add some description to that image';
export const MULTI_TURN_CAPTION_ASSISTANT = 'Added descriptions under your product images.';
export const MULTI_TURN_GRADIENT_USER =
  'change background of that section to blue-green gradient';

export const MULTI_TURN_NOISE_STYLE_USER = 'change the FAQ section title';

/** Chat through T2 (image placement + caption). */
export function conversationAfterCaptionTurn(): ConversationTurn[] {
  return [
    { role: 'user', content: MULTI_TURN_IMAGE_USER },
    { role: 'assistant', content: MULTI_TURN_IMAGE_ASSISTANT },
    { role: 'user', content: MULTI_TURN_CAPTION_USER },
    { role: 'assistant', content: MULTI_TURN_CAPTION_ASSISTANT },
  ];
}

/** Focus stack after T1 image placement. */
export function focusAfterImagePlacement(sectionIndex = 1): EditFocusStack {
  return {
    items: [
      editFocusFromLastGalleryEdit({
        sectionIndex,
        title: 'New Gallery',
        imageUrls: ['/uploads/single-new.png'],
        imageCount: 1,
      }),
    ],
  };
}

/** Focus stack after T2 caption (gallery_captions kind). */
export function focusAfterCaptionTurn(sectionIndex = 1): EditFocusStack {
  const placement = editFocusFromLastGalleryEdit(
    {
      sectionIndex,
      title: 'New Gallery',
      imageUrls: ['/uploads/single-new.png'],
      imageCount: 1,
    },
    'gallery_captions'
  );
  return { items: [placement] };
}

/** Simulate N-turn focus accumulation from successful agent results. */
export function simulateFocusChain(results: WebsiteEditAgentResult[]): EditFocusStack {
  let stack: EditFocusStack = { items: [] };
  for (const result of results) {
    stack = buildEditFocusStackAfterEdit({ priorStack: stack, result });
  }
  return stack;
}

/** Single-image gallery section for multi-turn chains. */
export async function seedSingleImageGallerySection(
  workspacePath: string,
  sectionIndex = 1
): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'New Gallery',
      body: 'Synthetic body',
      items: [
        {
          title: 'Photo',
          imageUrl: '/uploads/single-new.png',
          description: 'Professional work showcase.',
        },
      ],
    },
    { type: 'about', title: 'About', body: 'Synthetic body', items: [] },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
  void sectionIndex;
}

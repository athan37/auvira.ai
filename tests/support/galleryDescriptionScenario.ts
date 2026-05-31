import path from 'path';
import { promises as fs } from 'fs';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';

/** Matches project 6a1c43b965a882822ee0b113 chat turns 5–7. */
export const GALLERY_TURN_ONE_USER = 'add these images to a new sections';
export const GALLERY_TURN_ONE_ASSISTANT =
  'Added your product section with 4 image(s) in the preview. Scroll just below the hero to see it.';
export const GALLERY_TURN_TWO_USER = 'add more description to these images';

/** Turns 33–35: single image + "that image" follow-up. */
export const GALLERY_SINGLE_TURN_ONE_USER = 'add this image to a new section';
export const GALLERY_SINGLE_TURN_ONE_ASSISTANT =
  'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.';
export const GALLERY_SINGLE_TURN_TWO_USER = 'add some description to that image';

export const COMPOUND_IMAGE_MESSAGE =
  '1) add this image to a new section and 2) add some description to that image';

export const SPLIT_COMPOUND_GALLERY_MESSAGE =
  'Make a gallery. Also label each pic.';

export const TWIN_CAPTION_FOLLOW_UP = 'add more description to these images';

export const GENERIC_CONFIRM_CAPTION_FOLLOW_UP = 'add some description to that image';

export const NOISY_CAPTION_FOLLOW_UP = 'add some description to that image';

export const PARTIAL_CAPTION_FOLLOW_UP = 'finish the rest';

export const TITLE_DISAMBIG_CAPTION_MESSAGE =
  'add captions to the Winter Portfolio section';

export const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export function conversationAfterGalleryPlacement(): ConversationTurn[] {
  return [
    { role: 'user', content: GALLERY_TURN_ONE_USER },
    { role: 'assistant', content: GALLERY_TURN_ONE_ASSISTANT },
  ];
}

export function conversationAfterSingleImagePlacement(): ConversationTurn[] {
  return [
    { role: 'user', content: GALLERY_SINGLE_TURN_ONE_USER },
    { role: 'assistant', content: GALLERY_SINGLE_TURN_ONE_ASSISTANT },
  ];
}

/** Site state after turn 1: gallery section with four /uploads/ items, no descriptions yet. */
export async function seedGallerySiteConfigWithImages(workspacePath: string): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Our Work',
      body: 'Synthetic body',
      items: [
        { title: 'Photo 1', imageUrl: '/uploads/hvac-1.png' },
        { title: 'Photo 2', imageUrl: '/uploads/hvac-2.png' },
        { title: 'Photo 3', imageUrl: '/uploads/hvac-3.png' },
        { title: 'Photo 4', imageUrl: '/uploads/hvac-4.png' },
      ],
    },
    { type: 'about', title: 'hi, this is david', body: 'Synthetic body', items: [] },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
}

/** Multi-gallery site: Our Work (4 images) + newest section (1 image) — mirrors project after turn 34. */
export async function seedMultiGallerySiteConfig(workspacePath: string): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Our Work',
      body: 'Synthetic body',
      items: [
        { title: 'Photo 1', imageUrl: '/uploads/hvac-1.png' },
        { title: 'Photo 2', imageUrl: '/uploads/hvac-2.png' },
        { title: 'Photo 3', imageUrl: '/uploads/hvac-3.png' },
        { title: 'Photo 4', imageUrl: '/uploads/hvac-4.png' },
      ],
    },
    { type: 'gallery', title: 'hello', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Product Photos',
      body: 'Synthetic body',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
    { type: 'about', title: 'hi, this is david', body: 'Synthetic body', items: [] },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
}

export async function writeSyntheticUploadFiles(
  workspacePath: string,
  count = 4,
  prefix = 'hvac'
): Promise<WorkspaceAssetAttachment[]> {
  const uploadsDir = path.join(workspacePath, 'public/uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const attachments: WorkspaceAssetAttachment[] = [];
  for (let i = 1; i <= count; i += 1) {
    const fileName = `${prefix}-${i}.png`;
    const relPath = `public/uploads/${fileName}`;
    await fs.writeFile(path.join(workspacePath, relPath), PNG_BUFFER);
    attachments.push({
      id: String(i),
      path: relPath,
      publicUrl: `/uploads/${fileName}`,
      previewUrl: `/uploads/${fileName}`,
      originalName: fileName,
      mimeType: 'image/png',
      size: PNG_BUFFER.length,
    });
  }
  return attachments;
}

/** Count gallery item descriptions in parsed siteConfig. */
export function countGalleryItemDescriptions(siteConfigContent: string): number {
  const config = parseSiteConfigSource(siteConfigContent);
  if (!config?.sections?.length) return 0;

  let count = 0;
  for (const section of config.sections) {
    if (String(section.type ?? '').toLowerCase() !== 'gallery') continue;
    for (const item of section.items ?? []) {
      const description = (item as { description?: string }).description;
      if (typeof description === 'string' && description.trim().length > 0) {
        count += 1;
      }
    }
  }
  return count;
}

/** Descriptions on the gallery section with exactly one imageUrl. */
export function countSingleImageGalleryDescriptions(siteConfigContent: string): number {
  const config = parseSiteConfigSource(siteConfigContent);
  if (!config?.sections?.length) return 0;

  for (const section of config.sections) {
    const items = section.items ?? [];
    const withUrl = items.filter(
      (i) => typeof (i as { imageUrl?: string }).imageUrl === 'string'
    );
    if (withUrl.length !== 1) continue;
    return withUrl.filter(
      (i) =>
        typeof (i as { description?: string }).description === 'string' &&
        String((i as { description?: string }).description).trim().length > 0
    ).length;
  }
  return 0;
}

/** Descriptions within a gallery section matched by title. */
export function countDescriptionsInGallerySection(
  siteConfigContent: string,
  title: string
): number {
  const config = parseSiteConfigSource(siteConfigContent);
  if (!config?.sections?.length) return 0;

  const section = config.sections.find(
    (s) => String(s.title ?? '').toLowerCase() === title.toLowerCase()
  );
  if (!section) return 0;

  return (section.items ?? []).filter(
    (i) =>
      typeof (i as { description?: string }).description === 'string' &&
      String((i as { description?: string }).description).trim().length > 0
  ).length;
}

/** Two galleries: Showcase (2 imgs) + Product Photos (1 img) — ambiguous deictic targets. */
export async function seedDualGallerySiteConfig(workspacePath: string): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Our Work',
      body: 'Synthetic body',
      items: [
        { title: 'Photo 1', imageUrl: '/uploads/hvac-1.png' },
        { title: 'Photo 2', imageUrl: '/uploads/hvac-2.png' },
        { title: 'Photo 3', imageUrl: '/uploads/hvac-3.png' },
        { title: 'Photo 4', imageUrl: '/uploads/hvac-4.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Showcase',
      body: 'Synthetic body',
      items: [
        { title: 'Show A', imageUrl: '/uploads/show-a.png' },
        { title: 'Show B', imageUrl: '/uploads/show-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      body: 'Synthetic body',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
    { type: 'about', title: 'hi, this is david', body: 'Synthetic body', items: [] },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
}

/** Turn 1: 2-image placement, turn 2: 1-image placement — "them" should mean latest batch. */
export function conversationAfterDoubleGalleryPlacement(): ConversationTurn[] {
  return [
    { role: 'user', content: 'add these images to a new section called Showcase' },
    {
      role: 'assistant',
      content:
        'Added your product section with 2 image(s) in the preview. Scroll just below the hero to see it.',
    },
    { role: 'user', content: 'add this image to a new section' },
    {
      role: 'assistant',
      content:
        'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.',
    },
  ];
}

/** Image placement then unrelated style edit — caption should still resolve from earlier assistant. */
export function conversationWithInterveningStyleEdit(): ConversationTurn[] {
  return [
    { role: 'user', content: 'add this image to a new section' },
    {
      role: 'assistant',
      content:
        'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.',
    },
    {
      role: 'user',
      content: 'change the background color of the "Our Work" section to black',
    },
    {
      role: 'assistant',
      content: 'Changed background of "Our Work" to bg-black.',
    },
  ];
}

/** Two back-to-back 2-image placements — same count, must disambiguate via metadata. */
export function conversationAfterTwinTwoImagePlacements(): ConversationTurn[] {
  return [
    { role: 'user', content: 'add these 2 photos to a new section called Summer Portfolio' },
    {
      role: 'assistant',
      content:
        'Added your product section with 2 image(s) in the preview. Scroll just below the hero to see it.',
    },
    { role: 'user', content: 'add these 2 images to another new section called Winter Portfolio' },
    {
      role: 'assistant',
      content:
        'Added your product section with 2 image(s) in the preview. Scroll just below the hero to see it.',
    },
  ];
}

/** Generic assistant confirmation without "N image(s)" wording. */
export function conversationWithGenericImageConfirmation(): ConversationTurn[] {
  return [
    { role: 'user', content: 'add this image to a new section' },
    {
      role: 'assistant',
      content: 'Your images are live in the preview now.',
    },
  ];
}

/** Noisy chat: filler turns push the original placement to the edge of the 8-turn window. */
export function conversationWithNoisyInterveningTurns(): ConversationTurn[] {
  return [
    { role: 'user', content: 'add this image to a new section' },
    {
      role: 'assistant',
      content:
        'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.',
    },
    { role: 'user', content: 'change the FAQ section title' },
    { role: 'assistant', content: 'Updated the page content.' },
    { role: 'user', content: 'make the hero headline shorter' },
    { role: 'assistant', content: 'Updated the page content.' },
    { role: 'user', content: 'change contact phone to 555-0100' },
    { role: 'assistant', content: 'Updated contact info.' },
  ];
}

/** Twin 2-image galleries: Summer + Winter — same image count, different URLs. */
export async function seedTwinTwoImageGalleries(workspacePath: string): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Summer Portfolio',
      body: 'Synthetic body',
      items: [
        { title: 'Summer A', imageUrl: '/uploads/summer-a.png' },
        { title: 'Summer B', imageUrl: '/uploads/summer-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Winter Portfolio',
      body: 'Synthetic body',
      items: [
        { title: 'Winter A', imageUrl: '/uploads/winter-a.png' },
        { title: 'Winter B', imageUrl: '/uploads/winter-b.png' },
      ],
    },
    { type: 'about', title: 'About', body: 'Synthetic body', items: [] },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
}

/** Showcase with one described item and one missing — partial caption follow-up. */
export async function seedPartialDescShowcase(workspacePath: string): Promise<void> {
  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    {
      type: 'gallery',
      title: 'Showcase',
      body: 'Synthetic body',
      items: [
        { title: 'Done', imageUrl: '/uploads/show-a.png', description: 'Already done.' },
        { title: 'Pending', imageUrl: '/uploads/show-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      body: 'Synthetic body',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;
  await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
}

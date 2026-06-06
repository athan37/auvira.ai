import { describe, it, expect } from 'vitest';
import {
  applyCompoundGalleryCaptionFallback,
  applyPlaceholderGalleryDescriptions,
  isCaptionOnlyFollowUp,
  isCompoundImagePlacementAndCaption,
  resolveTargetGalleryForCaptions,
  wasRecentGalleryImageSectionCreated,
} from '../../src/lib/project-workspace/edit-shared/imageEditIntent';
import {
  COMPOUND_IMAGE_MESSAGE,
  conversationAfterTwinTwoImagePlacements,
  conversationWithGenericImageConfirmation,
  SPLIT_COMPOUND_GALLERY_MESSAGE,
  TITLE_DISAMBIG_CAPTION_MESSAGE,
} from '../support/galleryDescriptionScenario';

const MULTI_GALLERY_CONFIG = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Our Work',
      items: [
        { title: 'A', imageUrl: '/uploads/a.png' },
        { title: 'B', imageUrl: '/uploads/b.png' },
        { title: 'C', imageUrl: '/uploads/c.png' },
        { title: 'D', imageUrl: '/uploads/d.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;

describe('imageEditIntent', () => {
  it('detects compound placement + caption in one message', () => {
    expect(isCompoundImagePlacementAndCaption(COMPOUND_IMAGE_MESSAGE)).toBe(true);
    expect(isCompoundImagePlacementAndCaption('add this image to a new section')).toBe(false);
  });

  it('caption-only follow-up excludes compound and placement-with-attachments', () => {
    expect(isCaptionOnlyFollowUp('add some description to that image', false)).toBe(true);
    expect(isCaptionOnlyFollowUp(COMPOUND_IMAGE_MESSAGE, true)).toBe(false);
  });

  it('resolveTargetGalleryForCaptions picks 1-image gallery when history says 1 image', () => {
    const target = resolveTargetGalleryForCaptions(MULTI_GALLERY_CONFIG, [
      { role: 'user', content: 'add this image to a new section' },
      {
        role: 'assistant',
        content: 'Added your product section with 1 image(s) in the preview.',
      },
    ]);
    expect(target?.title).toBe('Product Photos');
    expect(target?.imageCount).toBe(1);
    expect(target?.sectionIndex).toBe(1);
  });

  it('resolveTargetGalleryForCaptions prefers lastGalleryEdit metadata', () => {
    const target = resolveTargetGalleryForCaptions(
      MULTI_GALLERY_CONFIG,
      [],
      {
        sectionIndex: 0,
        title: 'Our Work',
        imageUrls: ['/uploads/a.png'],
        imageCount: 4,
      }
    );
    expect(target?.sectionIndex).toBe(0);
    expect(target?.title).toBe('Our Work');
  });

  it('resolveTargetGalleryForCaptions skips intervening non-image assistant turns', () => {
    const target = resolveTargetGalleryForCaptions(MULTI_GALLERY_CONFIG, [
      { role: 'user', content: 'add this image to a new section' },
      {
        role: 'assistant',
        content: 'Added your product section with 1 image(s) in the preview.',
      },
      { role: 'user', content: 'change Our Work background to black' },
      { role: 'assistant', content: 'Changed background of "Our Work" to bg-black.' },
    ]);
    expect(target?.title).toBe('Product Photos');
    expect(target?.imageCount).toBe(1);
  });

  it('resolveTargetGalleryForCaptions picks latest batch after two placements', () => {
    const dualConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Showcase',
      items: [
        { title: 'A', imageUrl: '/uploads/a.png' },
        { title: 'B', imageUrl: '/uploads/b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(dualConfig, [
      { role: 'user', content: 'add images to Showcase' },
      { role: 'assistant', content: 'Added your product section with 2 image(s) in the preview.' },
      { role: 'user', content: 'add this image to a new section' },
      { role: 'assistant', content: 'Added your product section with 1 image(s) in the preview.' },
    ]);
    expect(target?.title).toBe('Product Photos');
    expect(target?.imageCount).toBe(1);
  });

  it('detects split-sentence compound gallery + label request', () => {
    expect(isCompoundImagePlacementAndCaption(SPLIT_COMPOUND_GALLERY_MESSAGE)).toBe(true);
  });

  it('twin 2-image galleries: lastGalleryEdit picks Winter over Summer', () => {
    const twinConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Summer Portfolio',
      items: [
        { title: 'Summer A', imageUrl: '/uploads/summer-a.png' },
        { title: 'Summer B', imageUrl: '/uploads/summer-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Winter Portfolio',
      items: [
        { title: 'Winter A', imageUrl: '/uploads/winter-a.png' },
        { title: 'Winter B', imageUrl: '/uploads/winter-b.png' },
      ],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(
      twinConfig,
      conversationAfterTwinTwoImagePlacements(),
      {
        sectionIndex: 1,
        title: 'Winter Portfolio',
        imageUrls: ['/uploads/winter-a.png', '/uploads/winter-b.png'],
        imageCount: 2,
      }
    );
    expect(target?.title).toBe('Winter Portfolio');
    expect(target?.sectionIndex).toBe(1);
  });

  it('twin 2-image galleries without metadata defaults to last matching section', () => {
    const twinConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Summer Portfolio',
      items: [
        { title: 'Summer A', imageUrl: '/uploads/summer-a.png' },
        { title: 'Summer B', imageUrl: '/uploads/summer-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Winter Portfolio',
      items: [
        { title: 'Winter A', imageUrl: '/uploads/winter-a.png' },
        { title: 'Winter B', imageUrl: '/uploads/winter-b.png' },
      ],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(
      twinConfig,
      conversationAfterTwinTwoImagePlacements()
    );
    expect(target?.title).toBe('Winter Portfolio');
  });

  it('resolveTargetGalleryForCaptions picks gallery named in owner message', () => {
    const twinConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Summer Portfolio',
      items: [
        { title: 'Summer A', imageUrl: '/uploads/summer-a.png' },
        { title: 'Summer B', imageUrl: '/uploads/summer-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Winter Portfolio',
      items: [
        { title: 'Winter A', imageUrl: '/uploads/winter-a.png' },
        { title: 'Winter B', imageUrl: '/uploads/winter-b.png' },
      ],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(
      twinConfig,
      conversationAfterTwinTwoImagePlacements(),
      {
        sectionIndex: 1,
        title: 'Winter Portfolio',
        imageUrls: ['/uploads/winter-a.png', '/uploads/winter-b.png'],
        imageCount: 2,
      },
      TITLE_DISAMBIG_CAPTION_MESSAGE
    );
    expect(target?.title).toBe('Winter Portfolio');
  });

  it('wasRecentGalleryImageSectionCreated accepts generic preview confirmation', () => {
    expect(wasRecentGalleryImageSectionCreated(conversationWithGenericImageConfirmation())).toBe(
      true
    );
  });

  it('resolveTargetGalleryForCaptions works with generic assistant (no image count)', () => {
    const singleConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Product Photos',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(
      singleConfig,
      conversationWithGenericImageConfirmation()
    );
    expect(target?.title).toBe('Product Photos');
    expect(target?.imageCount).toBe(1);
  });

  it('partial descriptions: prefers gallery with missing captions via lastGalleryEdit', () => {
    const partialConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Showcase',
      items: [
        { title: 'Done', imageUrl: '/uploads/show-a.png', description: 'Already done.' },
        { title: 'Pending', imageUrl: '/uploads/show-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(partialConfig, [], {
      sectionIndex: 0,
      title: 'Showcase',
      imageUrls: ['/uploads/show-a.png', '/uploads/show-b.png'],
      imageCount: 2,
    });
    expect(target?.title).toBe('Showcase');
    expect(target?.missingDescriptionCount).toBe(1);
  });

  it('partial descriptions: history count 2 prefers section with missing descriptions', () => {
    const partialConfig = `export const siteConfig = {
  sections: [
    {
      type: 'gallery',
      title: 'Showcase',
      items: [
        { title: 'Done', imageUrl: '/uploads/show-a.png', description: 'Already done.' },
        { title: 'Pending', imageUrl: '/uploads/show-b.png' },
      ],
    },
    {
      type: 'gallery',
      title: 'Product Photos',
      items: [{ title: 'Latest', imageUrl: '/uploads/latest-1.png' }],
    },
  ],
};`;
    const target = resolveTargetGalleryForCaptions(partialConfig, [
      { role: 'user', content: 'add these 2 images to Showcase' },
      { role: 'assistant', content: 'Added your product section with 2 image(s) in the preview.' },
    ]);
    expect(target?.title).toBe('Showcase');
    expect(target?.missingDescriptionCount).toBe(1);
  });

  it('applyPlaceholderGalleryDescriptions adds description to target section only', () => {
    const out = applyPlaceholderGalleryDescriptions(MULTI_GALLERY_CONFIG, {
      sectionIndex: 1,
      title: 'Product Photos',
      imageUrls: ['/uploads/latest-1.png'],
      imageCount: 1,
      missingDescriptionCount: 1,
    });
    expect(out).not.toBeNull();
    expect(out!).toMatch(/"description"\s*:/);
    expect(out!).toContain('Latest');
    const parsed = JSON.parse(out!.replace(/^export const siteConfig = /, '').replace(/;$/, ''));
    const ourWork = parsed.sections[0];
    expect(ourWork.items.every((i: { description?: string }) => !i.description)).toBe(true);
  });

  it('applyCompoundGalleryCaptionFallback labels every image in the last placement batch', () => {
    const freshGallery = `export const siteConfig = {
  sections: [
    { type: 'services', title: 'Services', items: [] },
    {
      type: 'gallery',
      title: 'Project Gallery',
      items: [
        { title: 'Split 1', imageUrl: '/uploads/split-1.png' },
        { title: 'Split 2', imageUrl: '/uploads/split-2.png' },
      ],
    },
  ],
};`;
    const out = applyCompoundGalleryCaptionFallback(
      freshGallery,
      {
        sectionIndex: 1,
        title: 'Project Gallery',
        imageUrls: ['/uploads/split-1.png', '/uploads/split-2.png'],
        imageCount: 2,
      },
      'label each pic.'
    );
    expect(out).not.toBeNull();
    expect(out!.match(/"description"\s*:/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

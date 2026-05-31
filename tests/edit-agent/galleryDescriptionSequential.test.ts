import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { createSyntheticWorkspace, readSyntheticFile } from '../support/syntheticSiteWorkspace';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';
import {
  conversationAfterGalleryPlacement,
  conversationAfterSingleImagePlacement,
  conversationAfterDoubleGalleryPlacement,
  conversationAfterTwinTwoImagePlacements,
  conversationWithInterveningStyleEdit,
  conversationWithGenericImageConfirmation,
  conversationWithNoisyInterveningTurns,
  countDescriptionsInGallerySection,
  countSingleImageGalleryDescriptions,
  GENERIC_CONFIRM_CAPTION_FOLLOW_UP,
  NOISY_CAPTION_FOLLOW_UP,
  PARTIAL_CAPTION_FOLLOW_UP,
  TWIN_CAPTION_FOLLOW_UP,
  GALLERY_SINGLE_TURN_TWO_USER,
  seedDualGallerySiteConfig,
  seedMultiGallerySiteConfig,
  seedPartialDescShowcase,
  seedTwinTwoImageGalleries,
  writeSyntheticUploadFiles,
} from '../support/galleryDescriptionScenario';

const GALLERY_SITE = {
  sections: [
    { type: 'services' as const, title: 'Complete HVAC Website Solutions' },
    {
      type: 'gallery' as const,
      title: 'Our Work',
      items: [
        { title: 'Photo 1', imageUrl: '/uploads/hvac-1.png' },
        { title: 'Photo 2', imageUrl: '/uploads/hvac-2.png' },
        { title: 'Photo 3', imageUrl: '/uploads/hvac-3.png' },
        { title: 'Photo 4', imageUrl: '/uploads/hvac-4.png' },
      ],
    },
    { type: 'about' as const, title: 'hi, this is david' },
  ],
};

const CHAT_AFTER_GALLERY_PLACED: ConversationTurn[] = [
  { role: 'user', content: 'add these images to a new sections' },
  {
    role: 'assistant',
    content:
      'Added your product section with 4 image(s) in the preview. Scroll just below the hero to see it.',
  },
];

describe('gallery description sequential (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turn 2: caption follow-up routes to gallery_captions without asking which images', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: GALLERY_SITE,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const gallerySiteConfig = `export const siteConfig = {
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
    await fs.writeFile(
      path.join(workspacePath, 'src/lib/siteConfig.ts'),
      gallerySiteConfig,
      'utf-8'
    );

    const withDescriptions = gallerySiteConfig.replace(
      "imageUrl: '/uploads/hvac-1.png'",
      "imageUrl: '/uploads/hvac-1.png', description: 'Professional HVAC installation.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescriptions }],
          summary: 'Added descriptions under your product images.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: 'add more description to these images',
      conversationHistory: CHAT_AFTER_GALLERY_PLACED,
      projectId: 'gallery-caption-seq',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toMatch(/\bdescription\s*:/);
  });

  it('turn 2 singular: that-image targets newest 1-image gallery in multi-gallery site', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Our Work' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedMultiGallerySiteConfig(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/latest-1.png'",
      "imageUrl: '/uploads/latest-1.png', description: 'Latest product photo.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Added a description under your product image.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GALLERY_SINGLE_TURN_TWO_USER,
      conversationHistory: conversationAfterSingleImagePlacement(),
      projectId: 'gallery-caption-singular',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countSingleImageGalleryDescriptions(siteConfig)).toBeGreaterThanOrEqual(1);
  });

  it('ambiguous 3-turn: intervening style edit still captions the 1-image gallery', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Our Work' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedMultiGallerySiteConfig(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/latest-1.png'",
      "imageUrl: '/uploads/latest-1.png', description: 'Latest install.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Added description to your latest product image.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GALLERY_SINGLE_TURN_TWO_USER,
      conversationHistory: conversationWithInterveningStyleEdit(),
      projectId: 'gallery-caption-intervening',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBeGreaterThanOrEqual(1);
    expect(countDescriptionsInGallerySection(siteConfig, 'Our Work')).toBe(0);
  });

  it('ambiguous 4-turn: double placement then "captions to them" targets latest 1-image gallery', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Showcase' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedDualGallerySiteConfig(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/latest-1.png'",
      "imageUrl: '/uploads/latest-1.png', description: 'Newest upload.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Added captions to your latest images.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: 'can you add captions to them',
      conversationHistory: conversationAfterDoubleGalleryPlacement(),
      projectId: 'gallery-caption-them',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 3,
        title: 'Product Photos',
        imageUrls: ['/uploads/latest-1.png'],
        imageCount: 1,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBeGreaterThanOrEqual(1);
    expect(countDescriptionsInGallerySection(siteConfig, 'Showcase')).toBe(0);
  });

  it('twin 2-image galleries: caption follow-up targets Winter via lastGalleryEdit', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'gallery', title: 'Summer Portfolio' },
          { type: 'gallery', title: 'Winter Portfolio' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedTwinTwoImageGalleries(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withWinterDesc = siteBefore.replace(
      "imageUrl: '/uploads/winter-b.png'",
      "imageUrl: '/uploads/winter-b.png', description: 'Winter detail.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withWinterDesc }],
          summary: 'Added captions to Winter Portfolio.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: TWIN_CAPTION_FOLLOW_UP,
      conversationHistory: conversationAfterTwinTwoImagePlacements(),
      projectId: 'gallery-caption-twin-winter',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 2,
        title: 'Winter Portfolio',
        imageUrls: ['/uploads/winter-a.png', '/uploads/winter-b.png'],
        imageCount: 2,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Winter Portfolio')).toBeGreaterThanOrEqual(
      1
    );
    expect(countDescriptionsInGallerySection(siteConfig, 'Summer Portfolio')).toBe(0);
  });

  it('generic assistant confirmation still routes gallery_captions', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [{ type: 'gallery', title: 'Product Photos' }],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedMultiGallerySiteConfig(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/latest-1.png'",
      "imageUrl: '/uploads/latest-1.png', description: 'Generic follow-up caption.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Added description under your image.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GENERIC_CONFIRM_CAPTION_FOLLOW_UP,
      conversationHistory: conversationWithGenericImageConfirmation(),
      projectId: 'gallery-caption-generic-confirm',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 3,
        title: 'Product Photos',
        imageUrls: ['/uploads/latest-1.png'],
        imageCount: 1,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');
  });

  it('noisy 8-turn window: caption still routes to 1-image gallery', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedMultiGallerySiteConfig(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/latest-1.png'",
      "imageUrl: '/uploads/latest-1.png', description: 'Noisy history caption.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Added description.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: NOISY_CAPTION_FOLLOW_UP,
      conversationHistory: conversationWithNoisyInterveningTurns(),
      projectId: 'gallery-caption-noisy',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 3,
        title: 'Product Photos',
        imageUrls: ['/uploads/latest-1.png'],
        imageCount: 1,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');
    expect(countDescriptionsInGallerySection(
      await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts'),
      'Product Photos'
    )).toBeGreaterThanOrEqual(1);
  });

  it('split compound caption phrase: label each pic routes gallery_captions', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Our Work' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await writeSyntheticUploadFiles(workspacePath, 1, 'split');
    const siteBefore = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Our Work',
      body: 'Synthetic body',
      items: [{ title: 'Split', imageUrl: '/uploads/split-1.png' }],
    },
  ],
};`;
    await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), siteBefore, 'utf-8');

    const withDescription = siteBefore.replace(
      "imageUrl: '/uploads/split-1.png'",
      "imageUrl: '/uploads/split-1.png', description: 'Split compound caption.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withDescription }],
          summary: 'Labeled each image.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: 'label each pic.',
      conversationHistory: [],
      projectId: 'gallery-split-caption-phrase',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 1,
        title: 'Our Work',
        imageUrls: ['/uploads/split-1.png'],
        imageCount: 1,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toMatch(/\bdescription\s*:/);
  });

  it('partial descriptions: finish the rest targets Showcase pending item', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'gallery', title: 'Showcase' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedPartialDescShowcase(workspacePath);

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withPendingDesc = siteBefore.replace(
      "imageUrl: '/uploads/show-b.png'",
      "imageUrl: '/uploads/show-b.png', description: 'Finished the rest.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withPendingDesc }],
          summary: 'Completed remaining captions.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: PARTIAL_CAPTION_FOLLOW_UP,
      conversationHistory: [],
      projectId: 'gallery-caption-partial',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 0,
        title: 'Showcase',
        imageUrls: ['/uploads/show-a.png', '/uploads/show-b.png'],
        imageCount: 2,
      },
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Showcase')).toBe(2);
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBe(0);
  });
});

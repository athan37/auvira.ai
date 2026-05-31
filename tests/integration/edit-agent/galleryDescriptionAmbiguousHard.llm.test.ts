import '../../llmTestGate';
import { expect, it } from 'vitest';
import { describeRunLlmIntegration } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  conversationAfterTwinTwoImagePlacements,
  conversationWithGenericImageConfirmation,
  conversationWithNoisyInterveningTurns,
  countDescriptionsInGallerySection,
  countSingleImageGalleryDescriptions,
  GENERIC_CONFIRM_CAPTION_FOLLOW_UP,
  NOISY_CAPTION_FOLLOW_UP,
  PARTIAL_CAPTION_FOLLOW_UP,
  SPLIT_COMPOUND_GALLERY_MESSAGE,
  TITLE_DISAMBIG_CAPTION_MESSAGE,
  TWIN_CAPTION_FOLLOW_UP,
  seedPartialDescShowcase,
  seedTwinTwoImageGalleries,
  seedMultiGallerySiteConfig,
  writeSyntheticUploadFiles,
} from '../../support/galleryDescriptionScenario';
import { mustSucceed } from '../../support/llmEditScenario';
import { createSyntheticWorkspace, readSyntheticFile } from '../../support/syntheticSiteWorkspace';

describeRunLlmIntegration('gallery description ambiguous hard (LLM)', () => {
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
    await writeSyntheticUploadFiles(workspacePath, 2, 'winter');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: TWIN_CAPTION_FOLLOW_UP,
      conversationHistory: conversationAfterTwinTwoImagePlacements(),
      projectId: 'llm-hard-twin-winter',
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

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Winter Portfolio')).toBeGreaterThanOrEqual(1);
    expect(countDescriptionsInGallerySection(siteConfig, 'Summer Portfolio')).toBe(0);
  });

  it('generic assistant without image count: that-image caption still works', async () => {
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
    await writeSyntheticUploadFiles(workspacePath, 1, 'latest');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GENERIC_CONFIRM_CAPTION_FOLLOW_UP,
      conversationHistory: conversationWithGenericImageConfirmation(),
      projectId: 'llm-hard-generic-confirm',
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

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countSingleImageGalleryDescriptions(siteConfig)).toBeGreaterThanOrEqual(1);
  });

  it('noisy 8-turn window: caption resolves to latest 1-image gallery', async () => {
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
    await writeSyntheticUploadFiles(workspacePath, 1, 'latest');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: NOISY_CAPTION_FOLLOW_UP,
      conversationHistory: conversationWithNoisyInterveningTurns(),
      projectId: 'llm-hard-noisy-window',
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

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBeGreaterThanOrEqual(1);
    expect(countDescriptionsInGallerySection(siteConfig, 'Our Work')).toBe(0);
  });

  it('split compound: make gallery and label each pic in one message', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'about', title: 'Why ServiceProMagic?' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    const attachments = await writeSyntheticUploadFiles(workspacePath, 2, 'split');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: SPLIT_COMPOUND_GALLERY_MESSAGE,
      conversationHistory: [],
      attachments,
      projectId: 'llm-hard-split-compound',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toMatch(/imageUrl/);
    expect(countSingleImageGalleryDescriptions(siteConfig) +
      countDescriptionsInGallerySection(siteConfig, 'Our Work') +
      countDescriptionsInGallerySection(siteConfig, 'Our work')).toBeGreaterThanOrEqual(1);
  });

  it('partial descriptions: finish the rest completes only missing Showcase captions', async () => {
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

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: PARTIAL_CAPTION_FOLLOW_UP,
      conversationHistory: [],
      projectId: 'llm-hard-partial-finish',
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

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Showcase')).toBe(2);
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBe(0);
  });

  it('title in message: add captions to Winter Portfolio section', async () => {
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

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: TITLE_DISAMBIG_CAPTION_MESSAGE,
      conversationHistory: conversationAfterTwinTwoImagePlacements(),
      projectId: 'llm-hard-title-winter',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
      lastGalleryEdit: {
        sectionIndex: 1,
        title: 'Summer Portfolio',
        imageUrls: ['/uploads/summer-a.png', '/uploads/summer-b.png'],
        imageCount: 2,
      },
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Winter Portfolio')).toBeGreaterThanOrEqual(1);
    expect(countDescriptionsInGallerySection(siteConfig, 'Summer Portfolio')).toBe(0);
  });
});

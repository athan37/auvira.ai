import '../../llmTestGate';
import { expect, it } from 'vitest';
import { describeRunLlmIntegration } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  conversationAfterDoubleGalleryPlacement,
  conversationWithInterveningStyleEdit,
  countDescriptionsInGallerySection,
  countSingleImageGalleryDescriptions,
  GALLERY_SINGLE_TURN_TWO_USER,
  seedDualGallerySiteConfig,
  seedMultiGallerySiteConfig,
  writeSyntheticUploadFiles,
} from '../../support/galleryDescriptionScenario';
import { mustSucceed } from '../../support/llmEditScenario';
import { createSyntheticWorkspace, readSyntheticFile } from '../../support/syntheticSiteWorkspace';

describeRunLlmIntegration('gallery description ambiguous multi-step (LLM)', () => {
  it('3-turn: image placement → unrelated style edit → "that image" caption', async () => {
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
      ownerMessage: GALLERY_SINGLE_TURN_TWO_USER,
      conversationHistory: conversationWithInterveningStyleEdit(),
      projectId: 'llm-ambiguous-intervening-style',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countDescriptionsInGallerySection(siteConfig, 'Product Photos')).toBeGreaterThanOrEqual(1);
    expect(countSingleImageGalleryDescriptions(siteConfig)).toBeGreaterThanOrEqual(1);
  });

  it('4-turn: two gallery placements then vague "captions to them"', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Our Work' },
          { type: 'gallery', title: 'Showcase' },
          { type: 'gallery', title: 'Product Photos' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedDualGallerySiteConfig(workspacePath);
    await writeSyntheticUploadFiles(workspacePath, 1, 'latest');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: 'can you add captions to them',
      conversationHistory: conversationAfterDoubleGalleryPlacement(),
      projectId: 'llm-ambiguous-them',
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
    expect(countDescriptionsInGallerySection(siteConfig, 'Showcase')).toBe(0);
  });

  it('compound natural language: new section + blurb under photo (no numbered steps)', async () => {
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
    const attachments = await writeSyntheticUploadFiles(workspacePath, 1, 'blurb');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage:
        'put this photo in a new section and write a short blurb underneath it',
      conversationHistory: [],
      attachments,
      projectId: 'llm-ambiguous-blurb-compound',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toMatch(/imageUrl/);
    expect(countDescriptionsInGallerySection(siteConfig, 'Our work') +
      countDescriptionsInGallerySection(siteConfig, 'Our Work') +
      countSingleImageGalleryDescriptions(siteConfig)).toBeGreaterThanOrEqual(1);
  });
});

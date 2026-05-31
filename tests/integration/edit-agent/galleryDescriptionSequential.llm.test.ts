import '../../llmTestGate';
import { expect, it } from 'vitest';
import { describeRunLlmIntegration } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  COMPOUND_IMAGE_MESSAGE,
  conversationAfterGalleryPlacement,
  conversationAfterSingleImagePlacement,
  countGalleryItemDescriptions,
  countSingleImageGalleryDescriptions,
  GALLERY_TURN_ONE_USER,
  GALLERY_TURN_TWO_USER,
  GALLERY_SINGLE_TURN_TWO_USER,
  seedGallerySiteConfigWithImages,
  seedMultiGallerySiteConfig,
  writeSyntheticUploadFiles,
} from '../../support/galleryDescriptionScenario';
import { mustSucceed } from '../../support/llmEditScenario';
import {
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';

const PRE_GALLERY_SITE = {
  sections: [
    { type: 'services' as const, title: 'Complete HVAC Website Solutions' },
    { type: 'about' as const, title: 'Why ServiceProMagic?' },
  ],
};

describeRunLlmIntegration('gallery description sequential (LLM integration)', () => {
  it('turn 1 LLM: add these images to a new section creates gallery with uploads', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: PRE_GALLERY_SITE,
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    const attachments = await writeSyntheticUploadFiles(workspacePath);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GALLERY_TURN_ONE_USER,
      conversationHistory: [],
      attachments,
      projectId: 'llm-gallery-seq-step1',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(['image_gallery', 'gallery_captions']).toContain(result.strategy);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toMatch(/imageUrl/);
    expect(siteConfig).toMatch(/\/uploads\//);
    expect((siteConfig.match(/imageUrl/g) ?? []).length).toBeGreaterThanOrEqual(attachments.length);
  });

  it('turn 2 LLM: caption follow-up on seeded gallery resolves these images without clarification', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Complete HVAC Website Solutions' },
          { type: 'gallery', title: 'Our Work' },
          { type: 'about', title: 'hi, this is david' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    await seedGallerySiteConfigWithImages(workspacePath);
    await writeSyntheticUploadFiles(workspacePath);

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: GALLERY_TURN_TWO_USER,
      conversationHistory: conversationAfterGalleryPlacement(),
      projectId: 'llm-gallery-caption-turn2',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countGalleryItemDescriptions(siteConfigAfter)).toBeGreaterThanOrEqual(4);
  });

  it('turn 2 singular LLM: that-image captions newest 1-image gallery without clarification', async () => {
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
      conversationHistory: conversationAfterSingleImagePlacement(),
      projectId: 'llm-gallery-singular-turn2',
      mode: 'gitlab',
      infraBaselineReady: true,
      attachments: [],
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.strategy).toBe('gallery_captions');

    const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countSingleImageGalleryDescriptions(siteConfigAfter)).toBeGreaterThanOrEqual(1);
  });

  it('compound LLM: single message places image and adds description', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: PRE_GALLERY_SITE,
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    const attachments = await writeSyntheticUploadFiles(workspacePath, 1, 'compound');

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: COMPOUND_IMAGE_MESSAGE,
      conversationHistory: [],
      attachments,
      projectId: 'llm-gallery-compound',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    mustSucceed(result, result.error ?? result.ownerMessage);
    expect(result.needsClarification, result.ownerMessage).toBeFalsy();

    const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfigAfter).toMatch(/imageUrl/);
    expect(countGalleryItemDescriptions(siteConfigAfter)).toBeGreaterThanOrEqual(1);
  });
});

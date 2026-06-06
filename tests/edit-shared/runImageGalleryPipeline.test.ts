import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { runImageGalleryThenCaptions } from '@/lib/project-workspace/edit-shared/runImageGalleryPipeline';
import { createSyntheticWorkspace, readSyntheticFile } from '../support/syntheticSiteWorkspace';
import {
  SPLIT_COMPOUND_GALLERY_MESSAGE,
  writeSyntheticUploadFiles,
  countGalleryItemDescriptions,
} from '../support/galleryDescriptionScenario';

vi.mock('@/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy', () => ({
  runGalleryItemDescriptionStrategy: vi.fn(),
}));

vi.mock('@/lib/project-workspace/edit-shared/imageGallerySectionStrategy', () => ({
  runImageGallerySectionStrategy: vi.fn(),
}));

import { runGalleryItemDescriptionStrategy } from '@/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy';
import { runImageGallerySectionStrategy } from '@/lib/project-workspace/edit-shared/imageGallerySectionStrategy';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';

describe('runImageGalleryThenCaptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies deterministic captions when LLM caption step fails after placement', async () => {
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

    const placedConfig = `export const siteConfig = {
  businessName: 'Synthetic HVAC',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    { type: 'services', title: 'Complete HVAC Website Solutions', body: 'Synthetic body', items: [] },
    {
      type: 'gallery',
      title: 'Project Gallery',
      body: 'Synthetic body',
      items: [
        { title: 'Split 1', imageUrl: '/uploads/split-1.png' },
        { title: 'Split 2', imageUrl: '/uploads/split-2.png' },
      ],
    },
    { type: 'about', title: 'Why ServiceProMagic?', body: 'Synthetic body', items: [] },
  ],
};`;
    await fs.writeFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), placedConfig, 'utf-8');

    vi.mocked(runImageGallerySectionStrategy).mockResolvedValue({
      ok: true,
      strategy: 'image_gallery',
      summary: 'Added gallery.',
      ownerMessage: 'Added gallery.',
      changedFiles: ['src/lib/siteConfig.ts'],
      lastGalleryEdit: {
        sectionIndex: 1,
        title: 'Project Gallery',
        imageUrls: ['/uploads/split-1.png', '/uploads/split-2.png'],
        imageCount: 2,
      },
    });

    vi.mocked(runGalleryItemDescriptionStrategy).mockResolvedValue({
      ok: false,
      strategy: 'gallery_captions',
      error: 'LLM caption failure',
      ownerMessage: 'Could not caption.',
    });

    const beforeHashes = await computeWorkspaceHashes(workspacePath);
    const result = await runImageGalleryThenCaptions(
      {
        workspacePath,
        ownerMessage: SPLIT_COMPOUND_GALLERY_MESSAGE,
        attachments,
        mode: 'gitlab',
        infraBaselineReady: true,
      },
      beforeHashes
    );

    expect(result?.ok, result?.error ?? result?.ownerMessage).toBe(true);
    expect(result?.strategy).toBe('gallery_captions');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(countGalleryItemDescriptions(siteConfig)).toBeGreaterThanOrEqual(2);
  });
});

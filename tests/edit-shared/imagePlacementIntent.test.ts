import { describe, it, expect } from 'vitest';
import {
  isImagePlacementRequest,
  isImageReplaceRequest,
  wantsNewImageSection,
  MISSING_IMAGE_ATTACHMENT_MESSAGE,
} from '../../src/lib/project-workspace/edit-shared/imagePlacementIntent';
import {
  analyzeSiteStructureForImages,
  planImagePlacementFallback,
} from '../../src/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { applyImagePlacementToSiteConfig } from '../../src/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import type { WorkspaceAssetAttachment } from '../../src/lib/project-workspace/workspaceAssetTypes';

const WITH_EXISTING_GALLERY = `export const siteConfig: SiteConfig = {
  "hero": { "headline": "Welcome" },
  "navigation": [{ "label": "Home", "href": "#top" }],
  "sections": [
    {
      "type": "gallery",
      "title": "Old Gallery",
      "items": [{ "title": "Prior", "imageUrl": "/uploads/old.png" }]
    },
    { "type": "services", "title": "Services", "items": [{ "title": "Repair" }] }
  ]
};`;

const newAttachments: WorkspaceAssetAttachment[] = [
  {
    id: '1',
    path: 'public/uploads/n1.png',
    publicUrl: '/uploads/n1.png',
    previewUrl: '/uploads/n1.png',
    originalName: 'n1.png',
    mimeType: 'image/png',
    size: 1,
  },
  {
    id: '2',
    path: 'public/uploads/n2.png',
    publicUrl: '/uploads/n2.png',
    previewUrl: '/uploads/n2.png',
    originalName: 'n2.png',
    mimeType: 'image/png',
    size: 1,
  },
];

describe('imagePlacementIntent', () => {
  it('detects image placement language', () => {
    expect(isImagePlacementRequest('add this image to the first section')).toBe(true);
    expect(isImageReplaceRequest('change photo to this', true)).toBe(true);
    expect(isImageReplaceRequest('add this image to the gallery', true)).toBe(false);
    expect(wantsNewImageSection('add these images to another section')).toBe(true);
    expect(wantsNewImageSection('add these images into a new section')).toBe(true);
    expect(isImagePlacementRequest('add some descriptions to these images')).toBe(false);
  });

  it('classifier requires attachments for image placement prompts', () => {
    expect(MISSING_IMAGE_ATTACHMENT_MESSAGE).toContain('attach');
  });

  it('creates a new gallery when another section is requested and one already exists', () => {
    const snap = analyzeSiteStructureForImages(WITH_EXISTING_GALLERY, '');
    const plan = planImagePlacementFallback(snap, 'add these images to another section');
    expect(plan.action).toBe('create_section');

    const out = applyImagePlacementToSiteConfig(
      WITH_EXISTING_GALLERY,
      plan,
      newAttachments,
      snap,
      'add these images to another section'
    );

    expect(out).toContain('"hero"');
    expect(out).toContain('"navigation"');
    expect(out).toContain('/uploads/n1.png');
    expect(out).toContain('/uploads/n2.png');
    expect(out).toContain('/uploads/old.png');
    expect((out.match(/"type":\s*"gallery"/g) ?? []).length).toBe(2);
  });
});

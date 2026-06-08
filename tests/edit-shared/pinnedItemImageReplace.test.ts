import { describe, expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import { runImageGallerySectionStrategy } from '@/lib/project-workspace/edit-shared/imageGallerySectionStrategy';
import { mergeGallerySectionItems } from '@/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import {
  isImageReplaceRequest,
  shouldUsePinnedCardImageReplace,
} from '@/lib/project-workspace/edit-shared/imagePlacementIntent';
import {
  applyPinnedItemImageReplaceToSource,
  resolvePinnedItemImageTarget,
  validatePinnedItemImageReplace,
} from '@/lib/project-workspace/edit-shared/pinnedItemImageReplace';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import { scratchPath } from '@/lib/runtime/scratchDir';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

const TESTIMONIALS_CONFIG = `export const siteConfig = {
  businessName: 'Synthetic Reviews',
  hero: { headline: 'Hero', subheadline: 'Tagline' },
  contact: {},
  sections: [
    {
      type: 'testimonials',
      title: 'Customer Reviews',
      body: 'What clients say',
      items: [
        { title: 'Alice', description: 'Great service', imageUrl: '/uploads/card-0.png' },
        { title: 'Bob', description: 'Reliable team', imageUrl: '/uploads/card-1.png' },
        { title: 'Carol', description: 'Highly recommend', imageUrl: '/uploads/card-2.png' },
      ],
    },
  ],
};`;

const FIXTURE_PAGE = readFileSync(
  path.join(process.cwd(), 'tests/fixtures/workspaces/section-loop-default/src/app/page.tsx'),
  'utf8'
).replace(
  "import { siteConfig } from '@/lib/siteConfig';\nimport type { SiteSection } from '@/lib/siteConfig';",
  'import { siteConfig } from "../lib/siteConfig";'
);

const NEW_ATTACHMENT: WorkspaceAssetAttachment = {
  id: 'new-photo',
  path: 'public/uploads/new-card-photo.png',
  publicUrl: '/uploads/new-card-photo.png',
  previewUrl: '/uploads/new-card-photo.png',
  originalName: 'new-card-photo.png',
  mimeType: 'image/png',
  size: 1024,
};

const PINNED_THIRD_CARD: SelectedTargetInput = {
  kind: 'section',
  sectionId: 'section_testimonials_0',
  sectionIndex: 0,
  sectionType: 'testimonials',
  sectionTitle: 'Customer Reviews',
  itemIndex: 2,
  fieldPath: 'sections[0].items[2].title',
  elementKind: 'heading',
  elementLabel: 'Carol',
  targetChain: [
    { role: 'section', label: 'Customer Reviews' },
    { role: 'item', label: 'Carol', itemIndex: 2, itemPosition: 3 },
  ],
};

async function createPinnedReplaceWorkspace(): Promise<string> {
  const dir = scratchPath('project-workspaces', 'pinned-item-image-replace');
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
  await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), TESTIMONIALS_CONFIG, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/page.tsx'), FIXTURE_PAGE, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body {}', 'utf-8');
  return dir;
}

describe('pinnedItemImageReplace', () => {
  it('detects replace intent for pinned card photo messages', () => {
    expect(isImageReplaceRequest('change photo to this', true)).toBe(true);
    expect(isImageReplaceRequest('replace the image on this card', true)).toBe(true);
    expect(isImageReplaceRequest('add this image to the gallery', true)).toBe(false);
    expect(shouldUsePinnedCardImageReplace('add this image', 1, true)).toBe(true);
    expect(shouldUsePinnedCardImageReplace('add these images to another section', 1, true)).toBe(
      false
    );
  });

  it('resolves itemIndex from pin metadata including targetChain', () => {
    expect(resolvePinnedItemImageTarget(PINNED_THIRD_CARD, TESTIMONIALS_CONFIG)).toEqual({
      sectionIndex: 0,
      itemIndex: 2,
      kind: 'sectionItem',
    });
  });

  it('updates pinned action card imageUrl without touching other cards', () => {
    const actionsConfig = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero' },
  contact: {},
  sections: [
    {
      type: 'actions',
      title: 'Service Packages',
      actionItems: [
        { id: 'basic', name: 'Basic Service', actionType: 'quote', imageUrl: '/uploads/a.png' },
        { id: 'standard', name: 'Standard Package', actionType: 'quote', imageUrl: '/uploads/b.png' },
        { id: 'premium', name: 'Premium Care', actionType: 'quote', imageUrl: '/uploads/c.png' },
      ],
    },
  ],
};`;
    const pinnedActionCard: SelectedTargetInput = {
      kind: 'section',
      sectionIndex: 0,
      sectionType: 'actions',
      sectionTitle: 'Service Packages',
      itemIndex: 2,
      fieldPath: 'sections[0].actionItems[2].name',
      elementLabel: 'Premium Care',
    };

    const updated = applyPinnedItemImageReplaceToSource(
      actionsConfig,
      0,
      2,
      NEW_ATTACHMENT.publicUrl,
      'actionItem'
    );
    expect(updated).toBeTruthy();
    expect(updated).toContain('/uploads/new-card-photo.png');
    expect(updated).toContain('/uploads/a.png');
    expect(updated).toContain('/uploads/b.png');

    const validation = validatePinnedItemImageReplace(
      updated!,
      0,
      2,
      NEW_ATTACHMENT.publicUrl,
      'actionItem'
    );
    expect(validation.ok).toBe(true);
    expect(resolvePinnedItemImageTarget(pinnedActionCard, actionsConfig)).toEqual({
      sectionIndex: 0,
      itemIndex: 2,
      kind: 'actionItem',
    });
  });

  it('treats bridge items[] fieldPath on actions section as actionItem', () => {
    const actionsConfig = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero' },
  contact: {},
  sections: [
    {
      type: 'actions',
      title: 'Service Packages',
      actionItems: [
        { id: 'basic', name: 'Basic Service', actionType: 'quote' },
        { id: 'standard', name: 'Standard Package', actionType: 'quote' },
        { id: 'premium', name: 'Premium Care', actionType: 'quote' },
      ],
    },
  ],
};`;
    const bridgePin: SelectedTargetInput = {
      kind: 'section',
      sectionIndex: 0,
      sectionType: 'actions',
      itemIndex: 2,
      fieldPath: 'sections[0].items[2].title',
    };
    expect(resolvePinnedItemImageTarget(bridgePin, actionsConfig)).toEqual({
      sectionIndex: 0,
      itemIndex: 2,
      kind: 'actionItem',
    });
  });

  it('runImageGallerySectionStrategy uses pinned card for add-this-image on actions', async () => {
    const actionsConfig = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero' },
  contact: {},
  sections: [
    {
      type: 'actions',
      title: 'Service Packages',
      actionItems: [
        { id: 'basic', name: 'Basic Service', actionType: 'quote' },
        { id: 'standard', name: 'Standard Package', actionType: 'quote' },
        { id: 'premium', name: 'Premium Care', actionType: 'quote' },
      ],
    },
  ],
};`;
    const actionsPage = `
function ActionSection({ section }) {
  return (
    <section>
      {section.actionItems?.map((item, i) => (
        item.imageUrl ? <img key={i} src={item.imageUrl} alt={item.name} /> : null
      ))}
    </section>
  );
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case 'actions': return <ActionSection section={section} />;
    default: return null;
  }
}
export default function Home() {
  return <main>{siteConfig.sections.map((section) => <SectionRenderer section={section} />)}</main>;
}`;
    const dir = scratchPath('project-workspaces', 'pinned-action-add-image');
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), actionsConfig, 'utf-8');
    await fs.writeFile(path.join(dir, 'src/app/page.tsx'), actionsPage, 'utf-8');
    await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body {}', 'utf-8');

    const pinnedThirdActionCard: SelectedTargetInput = {
      kind: 'section',
      sectionIndex: 0,
      sectionType: 'actions',
      sectionTitle: 'Service Packages',
      itemIndex: 2,
      fieldPath: 'sections[0].items[2].title',
      elementLabel: 'Premium Care',
    };

    const beforeHashes = await computeWorkspaceHashes(dir);
    const result = await runImageGallerySectionStrategy(
      {
        projectId: 'pinned-action-add-image-test',
        workspacePath: dir,
        ownerMessage: 'add this image',
        attachments: [NEW_ATTACHMENT],
        mode: 'gitlab',
        selectedTarget: pinnedThirdActionCard,
        infraBaselineReady: true,
      },
      beforeHashes
    );

    expect(result?.ok, result?.error ?? result?.ownerMessage).toBe(true);

    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    const validation = validatePinnedItemImageReplace(
      siteConfig,
      0,
      2,
      NEW_ATTACHMENT.publicUrl,
      'actionItem'
    );
    expect(validation.ok).toBe(true);
    expect(siteConfig).not.toMatch(/"name": "Basic Service"[\s\S]{0,200}\/uploads\/new-card-photo\.png/);

    await fs.rm(dir, { recursive: true, force: true });
  });

  it('updates only the pinned card imageUrl, not the first card', () => {
    const updated = applyPinnedItemImageReplaceToSource(
      TESTIMONIALS_CONFIG,
      0,
      2,
      NEW_ATTACHMENT.publicUrl
    );
    expect(updated).toBeTruthy();
    expect(updated).toContain('/uploads/new-card-photo.png');
    expect(updated).toContain('/uploads/card-0.png');
    expect(updated).toContain('/uploads/card-1.png');
    expect(updated).toMatch(/Carol[\s\S]*\/uploads\/new-card-photo\.png/);

    const validation = validatePinnedItemImageReplace(
      updated!,
      0,
      2,
      NEW_ATTACHMENT.publicUrl
    );
    expect(validation.ok).toBe(true);
  });

  it('regression: gallery merge fills from index 0 when slots are placeholders', () => {
    const items = [
      { title: 'Alice', imageUrl: '' },
      { title: 'Bob', imageUrl: '' },
      { title: 'Carol', imageUrl: '' },
    ];
    const merged = mergeGallerySectionItems(items, [NEW_ATTACHMENT]);
    expect(merged[0]?.imageUrl).toBe('/uploads/new-card-photo.png');
    expect(merged[2]).toBeUndefined();
  });

  it('regression: gallery merge appends when cards already have images', () => {
    const items = [
      { title: 'Alice', imageUrl: '/uploads/card-0.png' },
      { title: 'Bob', imageUrl: '/uploads/card-1.png' },
      { title: 'Carol', imageUrl: '/uploads/card-2.png' },
    ];
    const merged = mergeGallerySectionItems(items, [NEW_ATTACHMENT]);
    expect(merged).toHaveLength(4);
    expect(merged[3]?.imageUrl).toBe('/uploads/new-card-photo.png');
    expect(merged[2]?.imageUrl).toBe('/uploads/card-2.png');
  });

  it('runImageGallerySectionStrategy replaces photo on pinned 3rd card', async () => {
    const workspacePath = await createPinnedReplaceWorkspace();
    const beforeHashes = await computeWorkspaceHashes(workspacePath);

    const result = await runImageGallerySectionStrategy(
      {
        projectId: 'pinned-item-image-replace-test',
        workspacePath,
        ownerMessage: 'change photo to this',
        attachments: [NEW_ATTACHMENT],
        mode: 'gitlab',
        selectedTarget: PINNED_THIRD_CARD,
        infraBaselineReady: true,
      },
      beforeHashes
    );

    expect(result?.ok, result?.error ?? result?.ownerMessage).toBe(true);
    expect(result?.summary).toMatch(/card 3/i);

    const siteConfig = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('/uploads/new-card-photo.png');
    expect(siteConfig).toContain('/uploads/card-0.png');

    const validation = validatePinnedItemImageReplace(
      siteConfig,
      0,
      2,
      NEW_ATTACHMENT.publicUrl
    );
    expect(validation.ok).toBe(true);

    await fs.rm(workspacePath, { recursive: true, force: true });
  });
});

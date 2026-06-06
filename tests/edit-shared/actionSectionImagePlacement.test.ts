import { describe, expect, it } from 'vitest';
import {
  applyImagePlacementToSiteConfig,
  mergeActionSectionItems,
} from '@/lib/project-workspace/edit-shared/applyImagePlacementPlan';
import { resolveTargetSectionForImages } from '@/lib/project-workspace/edit-shared/imageSectionIntent';
import { analyzeSiteStructureForImages, planImagePlacementFallback } from '@/lib/project-workspace/edit-shared/siteStructureAnalysis';
import { validateGalleryInSiteConfigSource } from '@/lib/project-workspace/edit-shared/validateGallerySiteConfig';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';

const SERVICE_PACKAGES_CONFIG = `export const siteConfig = {
  businessName: "Demo HVAC",
  hero: { headline: "HVAC Pros" },
  contact: {},
  sections: [
    {
      type: "actions",
      title: "Service Packages",
      moduleKind: "service_packages",
      actionItems: [
        { id: "basic", name: "Basic Service", valueLabel: "From $149", actionType: "quote", ctaLabel: "Request Quote" },
        { id: "standard", name: "Standard Package", valueLabel: "From $299", actionType: "quote", ctaLabel: "Request Quote" },
        { id: "premium", name: "Premium Care", valueLabel: "From $499", actionType: "quote", ctaLabel: "Request Quote" }
      ]
    }
  ]
};`;

const PAGE_WITH_ACTIONS = `
function ActionSection() { return item.imageUrl ? <img src={item.imageUrl} /> : null; }
function SectionRenderer({ section }) {
  switch (section.type) {
    case "actions": return <ActionSection />;
    default: return null;
  }
}
export default function Home() {
  return siteConfig.sections.map((section) => <SectionRenderer section={section} />);
}`;

const attachments: WorkspaceAssetAttachment[] = [
  { publicUrl: '/uploads/a.jpg', originalName: 'a.jpg', storagePath: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 1 },
  { publicUrl: '/uploads/b.jpg', originalName: 'b.jpg', storagePath: 'b.jpg', mimeType: 'image/jpeg', sizeBytes: 1 },
  { publicUrl: '/uploads/c.jpg', originalName: 'c.jpg', storagePath: 'c.jpg', mimeType: 'image/jpeg', sizeBytes: 1 },
];

describe('action section image placement', () => {
  it('detects three action card image slots in structure snapshot', () => {
    const snap = analyzeSiteStructureForImages(SERVICE_PACKAGES_CONFIG, PAGE_WITH_ACTIONS);
    const section = snap.sections[0];
    expect(section?.type).toBe('actions');
    expect(section?.actionItemCount).toBe(3);
    expect(section?.actionItemsMissingImage).toBe(3);
  });

  it('merges attachments into existing actionItems in order', () => {
    const merged = mergeActionSectionItems(
      [
        { id: 'basic', name: 'Basic Service', actionType: 'quote' },
        { id: 'standard', name: 'Standard Package', actionType: 'quote' },
        { id: 'premium', name: 'Premium Care', actionType: 'quote' },
      ],
      attachments
    );
    expect(merged[0]?.imageUrl).toBe('/uploads/a.jpg');
    expect(merged[1]?.imageUrl).toBe('/uploads/b.jpg');
    expect(merged[2]?.imageUrl).toBe('/uploads/c.jpg');
    expect(merged[0]?.name).toBe('Basic Service');
  });

  it('places images into pinned actions section without converting to gallery', () => {
    const snap = analyzeSiteStructureForImages(SERVICE_PACKAGES_CONFIG, PAGE_WITH_ACTIONS);
    const plan = planImagePlacementFallback(snap, 'add these 3 images to the section', {
      sectionIndex: 0,
      sectionType: 'actions',
      sectionTitle: 'Service Packages',
    });

    expect(plan.sectionType).toBe('actions');
    expect(plan.targetSectionIndex).toBe(0);

    const out = applyImagePlacementToSiteConfig(
      SERVICE_PACKAGES_CONFIG,
      plan,
      attachments,
      snap,
      'add these 3 images to the section',
      { sectionIndex: 0, sectionType: 'actions', sectionTitle: 'Service Packages', kind: 'section' }
    );

    expect(out).toContain('"type": "actions"');
    expect(out).not.toContain('"type": "gallery"');
    expect(out).toContain('/uploads/a.jpg');
    expect(out).toContain('/uploads/b.jpg');
    expect(out).toContain('/uploads/c.jpg');
    expect(out).toContain('"name": "Basic Service"');

    const validation = validateGalleryInSiteConfigSource(out, attachments);
    expect(validation.ok).toBe(true);
  });

  it('maps three user-uploaded sketch images onto service package cards', () => {
    const userAttachments: WorkspaceAssetAttachment[] = [
      {
        publicUrl: '/uploads/3.17-e3b13394-9d8d-4e49-bac8-6a3c3933ee6a.png',
        originalName: '3.17-e3b13394-9d8d-4e49-bac8-6a3c3933ee6a.png',
        storagePath: '3.17-e3b13394-9d8d-4e49-bac8-6a3c3933ee6a.png',
        mimeType: 'image/png',
        sizeBytes: 26739,
      },
      {
        publicUrl: '/uploads/3.18-c7292620-8638-4742-bd36-3dbe5ad06354.png',
        originalName: '3.18-c7292620-8638-4742-bd36-3dbe5ad06354.png',
        storagePath: '3.18-c7292620-8638-4742-bd36-3dbe5ad06354.png',
        mimeType: 'image/png',
        sizeBytes: 24156,
      },
      {
        publicUrl: '/uploads/3.19-3528a284-e7d6-4f24-8716-519f0c6759eb.png',
        originalName: '3.19-3528a284-e7d6-4f24-8716-519f0c6759eb.png',
        storagePath: '3.19-3528a284-e7d6-4f24-8716-519f0c6759eb.png',
        mimeType: 'image/png',
        sizeBytes: 24000,
      },
    ];

    const snap = analyzeSiteStructureForImages(SERVICE_PACKAGES_CONFIG, PAGE_WITH_ACTIONS);
    const plan = planImagePlacementFallback(snap, 'add these 3 images to the section', {
      sectionIndex: 0,
      sectionType: 'actions',
      sectionTitle: 'Service Packages',
    });

    const out = applyImagePlacementToSiteConfig(
      SERVICE_PACKAGES_CONFIG,
      plan,
      userAttachments,
      snap,
      'add these 3 images to the section',
      { sectionIndex: 0, sectionType: 'actions', sectionTitle: 'Service Packages', kind: 'section' }
    );

    expect(out).toContain('/uploads/3.17-e3b13394-9d8d-4e49-bac8-6a3c3933ee6a.png');
    expect(out).toContain('/uploads/3.18-c7292620-8638-4742-bd36-3dbe5ad06354.png');
    expect(out).toContain('/uploads/3.19-3528a284-e7d6-4f24-8716-519f0c6759eb.png');

    const basicBlock = out.slice(out.indexOf('"id": "basic"'), out.indexOf('"id": "standard"'));
    const standardBlock = out.slice(out.indexOf('"id": "standard"'), out.indexOf('"id": "premium"'));
    const premiumBlock = out.slice(out.indexOf('"id": "premium"'));

    expect(basicBlock).toContain('3.17-e3b13394');
    expect(standardBlock).toContain('3.18-c7292620');
    expect(premiumBlock).toContain('3.19-3528a284');

    expect(validateGalleryInSiteConfigSource(out, userAttachments).ok).toBe(true);
  });
});

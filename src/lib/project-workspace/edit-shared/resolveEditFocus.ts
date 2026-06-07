import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { EditTarget, EditTargetCandidate } from '@/lib/project-workspace/edit-context/types';
import { isGalleryDescriptionRequest } from './galleryItemDescriptionStrategy';
import type { EditFocusStack } from './editFocus';
import type { SiteSectionCatalog } from './siteSectionCatalog';
import { extractSectionTitleCandidates } from './resolveSectionTarget';

function toCandidate(
  sectionIndex: number,
  sectionType: string | undefined,
  title: string,
  reason: string
): EditTargetCandidate {
  return {
    kind: 'section',
    sectionIndex,
    sectionTitle: title,
    sectionType,
    confidence: 'high',
    reason,
  };
}

function styleEditNeedsSectionTarget(message: string): boolean {
  const what = classifyEditWhat(message);
  return what === 'style_background' || what === 'style_text' || what === 'style_card';
}

function isDeicticSectionStyleMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(this|that)\s+section\b/i.test(message) ||
    (/\b(this|that)\b/i.test(message) &&
      /\b(background|color|colour|gradient|card)\b/i.test(lower))
  );
}

function isDeicticImageMessage(message: string): boolean {
  return (
    /\b(that|the|this)\s+image\b/i.test(message) ||
    /\b(these|those)\s+(image|images|photo|photos|picture|pictures)\b/i.test(message)
  );
}

function heroFocusTarget(reason: string): EditTarget {
  return {
    kind: 'hero',
    confidence: 'high',
    candidates: [
      {
        kind: 'hero',
        confidence: 'high',
        reason,
      },
    ],
    needsClarification: false,
    reason,
  };
}

/**
 * Resolve deictic references ("that section", "that image") using the edit focus stack.
 */
export function resolveDeicticTargetFromFocus(
  message: string,
  focusStack: EditFocusStack | null | undefined,
  catalog: SiteSectionCatalog
): EditTarget | null {
  if (!focusStack?.items.length) return null;
  if (extractSectionTitleCandidates(message).length > 0) return null;

  const top = focusStack.items[0]!;

  if (top.kind === 'hero' && styleEditNeedsSectionTarget(message)) {
    return heroFocusTarget(`Edit focus: hero (${top.sectionTitle})`);
  }

  const section = catalog.sections.find((s) => s.index === top.sectionIndex);
  if (!section) return null;

  const reason = `Edit focus: ${top.kind} on "${top.sectionTitle}" (index ${top.sectionIndex})`;

  if (isDeicticSectionStyleMessage(message) && styleEditNeedsSectionTarget(message)) {
    return {
      kind: 'section',
      sectionIndex: top.sectionIndex,
      sectionType: section.type,
      title: section.title,
      rendererComponent: section.rendererComponent,
      confidence: 'high',
      candidates: [toCandidate(top.sectionIndex, section.type, section.title, reason)],
      needsClarification: false,
      reason,
    };
  }

  if (isGalleryDescriptionRequest(message) || isDeicticImageMessage(message)) {
    const galleryKinds = new Set(['section_created', 'gallery_captions']);
    const focus =
      focusStack.items.find((f) => galleryKinds.has(f.kind)) ?? top;
    const focusedSection = catalog.sections.find((s) => s.index === focus.sectionIndex);
    if (!focusedSection) return null;

    return {
      kind: 'section',
      sectionIndex: focus.sectionIndex,
      sectionType: focusedSection.type,
      title: focusedSection.title,
      rendererComponent: focusedSection.rendererComponent,
      confidence: 'high',
      candidates: [
        toCandidate(
          focus.sectionIndex,
          focusedSection.type,
          focusedSection.title,
          `Edit focus: gallery section "${focus.sectionTitle}"`
        ),
      ],
      needsClarification: false,
      reason: `Edit focus: gallery section "${focus.sectionTitle}"`,
    };
  }

  return null;
}

/**
 * Enrich short deictic follow-ups with structured focus hints for the planner.
 */
export function enrichMessageWithEditFocus(
  message: string,
  focusStack: EditFocusStack | null | undefined
): string | null {
  if (!focusStack?.items.length) return null;

  const trimmed = message.trim();
  const top = focusStack.items[0]!;

  if (top.kind === 'hero' && styleEditNeedsSectionTarget(trimmed)) {
    return `${trimmed} (target: hero)`;
  }

  const targetHint = `section index ${top.sectionIndex}; title "${top.sectionTitle}"`;

  if (isGalleryDescriptionRequest(trimmed)) {
    const imageHint =
      top.imageCount != null
        ? `${top.imageCount} uploaded image(s)`
        : 'uploaded images';
    return `${trimmed} (target: ${targetHint}; ${imageHint})`;
  }

  if (isDeicticSectionStyleMessage(trimmed) && styleEditNeedsSectionTarget(trimmed)) {
    return `${trimmed} (target ${targetHint})`;
  }

  if (isDeicticImageMessage(trimmed)) {
    return `${trimmed} (target: ${targetHint})`;
  }

  if (/\bfinish the rest\b/i.test(trimmed)) {
    return `${trimmed} (target: ${targetHint}; complete missing captions only)`;
  }

  return null;
}

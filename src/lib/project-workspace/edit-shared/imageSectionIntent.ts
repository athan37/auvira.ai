import type { ImagePlacementPlan } from './imagePlacementPlan';
import { wantsNewImageSection } from './imagePlacementIntent';
import type { SiteStructureSnapshot } from './siteStructureAnalysis';
import type { SelectedTargetInput } from './selectedTargetTypes';

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

function titleMatchesIntent(title: string, intent: string): boolean {
  const t = title.toLowerCase().trim();
  const i = intent.toLowerCase().trim();
  if (!t || !i) return false;
  return t === i || t.includes(i) || i.includes(t);
}

/**
 * Resolve which siteConfig.sections index the owner wants for uploaded images.
 */
export function resolveTargetSectionForImages(
  ownerMessage: string,
  plan: ImagePlacementPlan,
  snapshot: SiteStructureSnapshot,
  selectedTarget?: SelectedTargetInput | null
): number {
  if (selectedTarget?.sectionIndex != null) {
    const pinned = snapshot.sections[selectedTarget.sectionIndex];
    if (pinned) {
      if (
        pinned.type === 'actions' ||
        selectedTarget.sectionType === 'actions' ||
        pinned.actionItemCount > 0
      ) {
        return selectedTarget.sectionIndex;
      }
      if (pinned.type === 'gallery' || pinned.hasImageItems || pinned.itemCount > 0) {
        return selectedTarget.sectionIndex;
      }
    }
  }

  if (plan.action === 'create_section' || wantsNewImageSection(ownerMessage)) {
    return -1;
  }

  if (plan.targetSectionIndex != null && snapshot.sections[plan.targetSectionIndex]) {
    return plan.targetSectionIndex;
  }

  if (plan.targetSectionTitle) {
    const exact = snapshot.sections.findIndex((s) =>
      titleMatchesIntent(s.title, plan.targetSectionTitle!)
    );
    if (exact >= 0) return exact;
  }

  const lower = ownerMessage.toLowerCase();

  if (/\bfirst\s+section\b/i.test(lower) && snapshot.sections.length > 0) {
    return 0;
  }

  if (messageHasKeyword(lower, 'introduction') || messageHasKeyword(lower, 'intro')) {
    const byTitle = snapshot.sections.findIndex((s) =>
      /\b(introduction|intro)\b/i.test(s.title)
    );
    if (byTitle >= 0) return byTitle;
    const about = snapshot.sections.findIndex((s) => s.type === 'about');
    if (about >= 0) return about;
    const first = snapshot.sections.findIndex(
      (s) => !['contact', 'faq', 'gallery'].includes(s.type)
    );
    if (first >= 0) return first;
  }

  if (messageHasKeyword(lower, 'about')) {
    const about = snapshot.sections.findIndex((s) => s.type === 'about');
    if (about >= 0) return about;
  }

  if (messageHasKeyword(lower, 'service')) {
    const services = snapshot.sections.findIndex((s) => s.type === 'services');
    if (services >= 0) return services;
  }

  if (plan.targetSectionTitle) {
    const partial = snapshot.sections.findIndex((s) =>
      titleMatchesIntent(s.title, plan.targetSectionTitle!)
    );
    if (partial >= 0) return partial;
  }

  if (plan.action === 'update_section') {
    const actionsWithSlots = snapshot.sections.find(
      (s) => s.type === 'actions' && s.actionItemCount > 0 && s.actionItemsMissingImage > 0
    );
    if (actionsWithSlots) return actionsWithSlots.index;

    const withImages = snapshot.sections.findIndex((s) => s.hasImageItems);
    if (withImages >= 0) return withImages;
  }

  if (messageHasKeyword(lower, 'gallery')) {
    const galleryIdx = snapshot.sections.findIndex((s) => s.type === 'gallery');
    if (galleryIdx >= 0) return galleryIdx;
  }

  const galleryWithSlots = snapshot.sections.findIndex(
    (s) => s.type === 'gallery' || (s.itemCount > 0 && !s.hasImageItems)
  );
  if (galleryWithSlots >= 0 && attachmentsMentionedInMessage(lower)) {
    return galleryWithSlots;
  }

  return -1;
}

function attachmentsMentionedInMessage(lower: string): boolean {
  return (
    /\b(image|images|photo|photos|picture|pictures|upload|these|those)\b/.test(lower) ||
    /\badd\b/.test(lower)
  );
}

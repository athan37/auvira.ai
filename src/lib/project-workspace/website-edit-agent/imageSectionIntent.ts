import type { ImagePlacementPlan } from './imagePlacementPlan';
import type { SiteStructureSnapshot } from './siteStructureAnalysis';

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
  snapshot: SiteStructureSnapshot
): number {
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
    const withImages = snapshot.sections.findIndex((s) => s.hasImageItems);
    if (withImages >= 0) return withImages;
  }

  return -1;
}

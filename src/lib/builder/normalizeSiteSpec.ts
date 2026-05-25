import type { SiteSpec } from '../agent/schemas';
import { normalizeSiteSpecColors } from './cssColor';

/**
 * Normalize site spec after LLM edits so file generation produces valid CSS and hero copy.
 */
export function normalizeSiteSpec(siteSpec: SiteSpec): SiteSpec {
  const sections = siteSpec.sections.map((s) => ({ ...s, items: [...(s.items || [])] }));

  const heroIndex = sections.findIndex((s) => s.type === 'hero');
  let siteTitle = siteSpec.siteTitle?.trim() || 'Business Website';
  let tagline = siteSpec.tagline?.trim() || '';

  if (heroIndex >= 0) {
    const hero = sections[heroIndex];
    const heroTitle = hero.title?.trim();
    const heroBody = hero.body?.trim();

    // Prefer explicit hero section title as headline when present
    if (heroTitle) {
      siteTitle = heroTitle;
    }

    // Keep hero section title in sync with resolved headline
    sections[heroIndex] = {
      ...hero,
      title: siteTitle,
      body: heroBody || hero.body,
    };
  }

  const colors = normalizeSiteSpecColors(siteSpec.designDirection?.colors);

  return {
    ...siteSpec,
    siteTitle,
    tagline,
    sections,
    designDirection: {
      ...siteSpec.designDirection,
      colors: colors.length > 0 ? colors : siteSpec.designDirection?.colors || [],
    },
  };
}

/**
 * DOM attribute helpers for preview section selection.
 * Embedded in generated page.tsx via pageTemplate / injectAnalyticsRuntime.
 */

/** JSX spread helper source injected into generated page.tsx. */
export const SITE_SECTION_DATA_ATTRS_HELPER = `
function SITE_SECTION_DATA_ATTRS(section: SiteSection, sectionIndex: number) {
  return {
    "data-site-section-id": section.analyticsId || section.id || slugify(String(section.title || "section")),
    "data-site-section-index": String(sectionIndex),
    "data-site-section-type": section.type,
    "data-site-section-title": section.title,
  };
}
`.trim();

/** Inline attrs for post-instrumentation string replace (section + sectionIndex in scope). */
export const SITE_SECTION_DOM_ATTRS_INLINE =
  'data-site-section-id={section.analyticsId || section.id || slugify(section.title)} data-site-section-index={sectionIndex} data-site-section-type={section.type} data-site-section-title={section.title}';

export const HERO_SITE_SECTION_DOM_ATTRS =
  'data-site-section-id="hero" data-site-section-index="-1" data-site-section-type="hero" data-site-section-title="Hero"';

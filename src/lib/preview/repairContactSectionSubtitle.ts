/**
 * Wire contact inner-card heading to sections[n].subtitle in legacy page.tsx files.
 * Older generated sites hardcoded "Contact Information" instead of reading siteConfig.
 */

const HARDCODED_CONTACT_H3 =
  /(<h3[^>]*>)\s*Contact Information\s*(<\/h3>)/g;

const SUBTITLE_BINDING = "{section.subtitle || 'Contact Information'}";

/** Replace hardcoded contact card h3 with section.subtitle binding. */
export function repairContactSectionSubtitleInPage(pageContent: string): {
  content: string;
  repaired: boolean;
} {
  if (!HARDCODED_CONTACT_H3.test(pageContent)) {
    return { content: pageContent, repaired: false };
  }

  HARDCODED_CONTACT_H3.lastIndex = 0;
  const next = pageContent.replace(
    HARDCODED_CONTACT_H3,
    `$1${SUBTITLE_BINDING}$2`
  );

  return {
    content: next,
    repaired: next !== pageContent,
  };
}

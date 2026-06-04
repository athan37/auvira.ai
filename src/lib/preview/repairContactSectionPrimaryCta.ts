/**
 * Wire contact-section primary CTA button to hero.primaryCta in legacy page.tsx files.
 */

const HARDCODED_CONTACT_PRIMARY_CTA =
  /(<a[^>]*href="#contact"[^>]*className=\{[^}]+\}[^>]*)>\s*Get in Touch\s*(<\/a>)/g;

const PRIMARY_CTA_BINDING = '{siteConfig.hero.primaryCta}';

/** Replace hardcoded contact primary CTA label with hero.primaryCta binding. */
export function repairContactSectionPrimaryCtaInPage(pageContent: string): {
  content: string;
  repaired: boolean;
} {
  if (!pageContent.includes('Get in Touch') || pageContent.includes('hero.primaryCta')) {
    return { content: pageContent, repaired: false };
  }

  HARDCODED_CONTACT_PRIMARY_CTA.lastIndex = 0;
  const next = pageContent.replace(
    HARDCODED_CONTACT_PRIMARY_CTA,
    `$1>${PRIMARY_CTA_BINDING}$2`
  );

  return {
    content: next,
    repaired: next !== pageContent,
  };
}

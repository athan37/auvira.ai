/** Section type union emitted in generated customer siteConfig.ts files. */
export const SITE_SECTION_TYPE_UNION =
  "'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic' | 'gallery' | 'documentation'";

export const SITE_SECTION_ITEMS_TYPE =
  'Array<{ title: string; description?: string; imageUrl?: string }>';

export const SITE_CONFIG_TYPE_BLOCK = `export type SiteSection = {
  type: ${SITE_SECTION_TYPE_UNION};
  title: string;
  subtitle?: string;
  body?: string;
  items?: ${SITE_SECTION_ITEMS_TYPE};
};

export type SiteConfig = {
  businessName: string;
  tagline?: string;
  description?: string;
  hero: {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    primaryCta?: string;
    secondaryCta?: string;
  };
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  sections: SiteSection[];
};
`;

const LEGACY_SECTION_TYPE_PATTERN =
  /type:\s*'services'\s*\|\s*'about'\s*\|\s*'features'\s*\|\s*'faq'\s*\|\s*'testimonials'\s*\|\s*'contact'\s*\|\s*'generic'/;

const LEGACY_ITEMS_TYPE_PATTERN =
  /items\?\:\s*Array<\{\s*title:\s*string;\s*description\?\:\s*string\s*\}>/;

/**
 * Upgrade legacy siteConfig.ts type exports so gallery sections and imageUrl items type-check.
 */
export function ensureSiteConfigTypesSupportGallery(content: string): string {
  let out = content;
  if (LEGACY_SECTION_TYPE_PATTERN.test(out) && !out.includes("'gallery'")) {
    out = out.replace(LEGACY_SECTION_TYPE_PATTERN, `type: ${SITE_SECTION_TYPE_UNION}`);
  }
  if (LEGACY_ITEMS_TYPE_PATTERN.test(out) && !out.includes('imageUrl?:')) {
    out = out.replace(LEGACY_ITEMS_TYPE_PATTERN, SITE_SECTION_ITEMS_TYPE);
  }
  return out;
}

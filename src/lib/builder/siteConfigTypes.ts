/** Section type union emitted in generated customer siteConfig.ts files. */
export const SITE_SECTION_TYPE_UNION =
  "'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic' | 'gallery' | 'documentation'";

export const SITE_SECTION_ITEMS_TYPE =
  'Array<{ title: string; description?: string; imageUrl?: string }>';

export const SITE_SECTION_PRESENTATION_TYPE = `export type SiteSectionPresentation = {
  backgroundClass?: string;
  cardClass?: string;
  eyebrowClass?: string;
  titleClass?: string;
  bodyClass?: string;
};`;

export const SITE_SECTION_TYPE_BLOCK = `export type SiteSection = {
  id?: string;
  analyticsId?: string;
  type: ${SITE_SECTION_TYPE_UNION};
  title: string;
  subtitle?: string;
  body?: string;
  items?: ${SITE_SECTION_ITEMS_TYPE};
  presentation?: SiteSectionPresentation;
};`;

export const SITE_SECTION_TYPES_WITH_PRESENTATION = `${SITE_SECTION_PRESENTATION_TYPE}

${SITE_SECTION_TYPE_BLOCK}`;

export const SITE_CONFIG_ONLY_TYPE_BLOCK = `export type SiteConfig = {
  businessName: string;
  tagline?: string;
  description?: string;
  navigation?: Array<{ label: string; href: string }>;
  hero: {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    primaryCta?: string;
    secondaryCta?: string;
    cta?: Array<{ label: string; href: string }>;
  };
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  sections: SiteSection[];
};`;

export const SITE_CONFIG_TYPE_BLOCK = `${SITE_SECTION_TYPES_WITH_PRESENTATION}

${SITE_CONFIG_ONLY_TYPE_BLOCK}
`;

const LEGACY_SECTION_TYPE_PATTERN =
  /type:\s*'services'\s*\|\s*'about'\s*\|\s*'features'\s*\|\s*'faq'\s*\|\s*'testimonials'\s*\|\s*'contact'\s*\|\s*'generic'/;

const LEGACY_SECTION_TYPE_DOUBLE_QUOTE =
  /type:\s*"services"\s*\|\s*"about"\s*\|\s*"features"\s*\|\s*"faq"\s*\|\s*"testimonials"\s*\|\s*"contact"\s*\|\s*"generic"/;

const LEGACY_ITEMS_TYPE_PATTERN =
  /items\?\:\s*Array<\{\s*title:\s*string;\s*description\?\:\s*string\s*\}>/;

const GALLERY_IN_SECTION_DATA =
  /["']type["']\s*:\s*["']gallery["']|type\s*:\s*['"]gallery['"]/;

const SITE_SECTION_BLOCK_PATTERN = /export type SiteSection\s*=\s*\{[\s\S]*?\n\};/;
const SITE_CONFIG_BLOCK_PATTERN = /export type SiteConfig\s*=\s*\{[\s\S]*?\n\};/;

const SITE_CONFIG_DATA_NAV = /"navigation"\s*:\s*\[/;
const SITE_CONFIG_DATA_HERO_CTA = /"cta"\s*:\s*\[/;

/** True when siteConfig data references a gallery section. */
export function siteConfigDataUsesGallery(content: string): boolean {
  return GALLERY_IN_SECTION_DATA.test(content);
}

/** True when gallery sections exist but SiteSection.type union omits gallery. */
export function siteConfigNeedsGalleryTypeUpgrade(content: string): boolean {
  if (!siteConfigDataUsesGallery(content)) return false;
  const block = content.match(SITE_SECTION_BLOCK_PATTERN)?.[0];
  if (!block) return true;
  return !/\bgallery\b/.test(block);
}

/**
 * Upgrade legacy siteConfig.ts type exports so gallery sections and imageUrl items type-check.
 */
export function ensureSiteConfigTypesSupportGallery(content: string): string {
  let out = content;

  if (siteConfigNeedsGalleryTypeUpgrade(out) && SITE_SECTION_BLOCK_PATTERN.test(out)) {
    out = out.replace(SITE_SECTION_BLOCK_PATTERN, SITE_SECTION_TYPE_BLOCK);
  }

  if (SITE_CONFIG_BLOCK_PATTERN.test(out)) {
    const needsNav =
      SITE_CONFIG_DATA_NAV.test(out) &&
      !/navigation\??\s*:/.test(out.match(SITE_CONFIG_BLOCK_PATTERN)?.[0] || '');
    const needsHeroCta =
      SITE_CONFIG_DATA_HERO_CTA.test(out) &&
      !/\bcta\??\s*:/.test(out.match(SITE_CONFIG_BLOCK_PATTERN)?.[0] || '');
    if (needsNav || needsHeroCta) {
      out = out.replace(SITE_CONFIG_BLOCK_PATTERN, SITE_CONFIG_ONLY_TYPE_BLOCK);
    }
  }

  if (LEGACY_SECTION_TYPE_PATTERN.test(out) && !out.includes("'gallery'")) {
    out = out.replace(LEGACY_SECTION_TYPE_PATTERN, `type: ${SITE_SECTION_TYPE_UNION}`);
  }
  if (LEGACY_SECTION_TYPE_DOUBLE_QUOTE.test(out) && !out.includes('"gallery"')) {
    out = out.replace(
      LEGACY_SECTION_TYPE_DOUBLE_QUOTE,
      `type: ${SITE_SECTION_TYPE_UNION.replace(/'/g, '"')}`
    );
  }
  if (LEGACY_ITEMS_TYPE_PATTERN.test(out) && !out.includes('imageUrl?:')) {
    out = out.replace(
      LEGACY_ITEMS_TYPE_PATTERN,
      `items?: ${SITE_SECTION_ITEMS_TYPE}`
    );
  }

  return ensureSiteConfigTypesSupportPresentation(out);
}

/** True when siteConfig data uses presentation but types omit SiteSectionPresentation. */
export function siteConfigNeedsPresentationTypeUpgrade(content: string): boolean {
  if (!/presentation\s*:/.test(content)) {
    const block = content.match(SITE_SECTION_BLOCK_PATTERN)?.[0];
    return Boolean(block && !block.includes('presentation?:'));
  }
  return !content.includes('SiteSectionPresentation');
}

/**
 * Ensure SiteSection includes optional presentation tokens in generated types.
 */
export function ensureSiteConfigTypesSupportPresentation(content: string): string {
  let out = content;

  if (!out.includes('SiteSectionPresentation') && SITE_SECTION_BLOCK_PATTERN.test(out)) {
    const block = out.match(SITE_SECTION_BLOCK_PATTERN)?.[0] ?? '';
    if (!block.includes('presentation?:')) {
      const sectionStart = out.indexOf('export type SiteSection');
      if (sectionStart >= 0) {
        out =
          out.slice(0, sectionStart) +
          `${SITE_SECTION_PRESENTATION_TYPE}\n\n` +
          out.slice(sectionStart).replace(SITE_SECTION_BLOCK_PATTERN, SITE_SECTION_TYPE_BLOCK);
      }
    }
  }

  return out;
}

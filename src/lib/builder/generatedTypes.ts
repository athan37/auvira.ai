// These types must match what generatePageTsx expects in the generated siteConfig.ts
export interface SiteSpecSection {
  type: string;
  title: string;
  body: string;
  items: string[];
}

export interface SiteSpecDesignDirection {
  tone: string;
  layout: string;
  colors: string[];
}

export interface SiteSpec {
  siteTitle: string;
  tagline: string;
  primaryCTA: string;
  secondaryCTA: string;
  sections: SiteSpecSection[];
  designDirection: SiteSpecDesignDirection;
}
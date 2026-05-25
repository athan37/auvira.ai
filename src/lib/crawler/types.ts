export interface PageImage {
  src: string;
  alt: string;
  text?: string; // caption or surrounding text
}

export interface PageLinks {
  internal: string[];
  external: string[];
  social: string[];
  phone: string[];
  email: string[];
}

export interface BusinessSignals {
  phoneNumbers: string[];
  emails: string[];
  addresses: string[];
  ctaCandidates: string[];
  serviceKeywords: string[];
}

export interface DeepContent {
  fullText: string; // complete text, not truncated
  ogTags: { ogTitle?: string; ogDescription?: string; ogImage?: string; ogType?: string };
  metaKeywords: string;
  schemaData: Array<{ type: string; data: Record<string, unknown> }>; // parsed structured data by type
  faqContent: Array<{ q: string; a: string }>; // extracted FAQ items
  altTexts: string[]; // all image alt texts for accessibility
  hiddenText: string; // text from data attributes, aria-labels, etc.
}

export interface CrawledPage {
  url: string;
  normalizedUrl: string;
  canonicalUrl?: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  h3: string[];
  visibleText: string;
  textLength: number;
  links: PageLinks;
  images: PageImage[];
  structuredData: unknown[];
  businessSignals: BusinessSignals;
  deepContent?: DeepContent; // only populated when deep fetch is enabled
}

export interface CrawlOptions {
  maxPages: number;
  maxConcurrency: number;
  timeoutMs: number;
  maxCharsPerPage: number;
  deepFetch?: boolean; // if true, extract full text, schema, FAQ, OG tags, etc.
  useHeadless?: boolean; // if true, use headless browser (for JS-heavy SPAs)
}

export interface SiteSummary {
  pageCount: number;
  totalTextLength: number;
  discoveredInternalLinks: number;
  crawledInternalLinks: number;
  skippedLinks: string[];
}

export interface GlobalSignals {
  businessNameCandidates: string[];
  phoneNumbers: string[];
  emails: string[];
  addresses: string[];
  socialLinks: string[];
  mapLinks: string[];
  bookingLinks: string[];
  contactLinks: string[];
  serviceKeywords: string[];
  ctaCandidates: string[];
}

export interface CrawledSite {
  sourceUrl: string;
  normalizedSourceUrl: string;
  domain: string;
  crawledAt: string;
  pages: CrawledPage[];
  siteSummary: SiteSummary;
  globalSignals: GlobalSignals;
  warnings: string[];
}
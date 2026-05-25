import * as cheerio from 'cheerio';
import type { DeepContent } from './types';

export interface PageMetadata {
  title: string;
  metaDescription: string;
  canonicalUrl?: string;
  h1: string[];
  h2: string[];
  h3: string[];
  visibleText: string;
  importantText: string;
  textLength: number;
  links: {
    internal: string[];
    external: string[];
    social: string[];
    phone: string[];
    email: string[];
  };
  images: { src: string; alt: string }[];
  structuredData: unknown[];
  businessSignals: {
    phoneNumbers: string[];
    emails: string[];
    addresses: string[];
    ctaCandidates: string[];
    serviceKeywords: string[];
  };
  deepContent?: DeepContent;
}

// High priority keywords for link scoring
const HIGH_PRIORITY_KEYWORDS = [
  'service', 'services', 'about', 'contact', 'pricing', 'menu',
  'appointment', 'booking', 'schedule', 'quote', 'estimate',
  'faq', 'locations', 'team', 'gallery', 'portfolio',
  'testimonials', 'reviews', 'home', 'index',
];

// Low priority/skipped keywords
const SKIP_KEYWORDS = [
  'privacy', 'terms', 'login', 'cart', 'checkout', 'account',
  'wp-admin', 'tag', 'category', 'author', 'feed', 'sitemap',
  'search', 'blog', 'comment', 'policy', 'archive', 'date',
  'attachment', 'media', 'wp-content', 'wp-includes',
];

// US phone regex
const PHONE_REGEX = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Street address keywords
const STREET_WORDS = [
  'street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd',
  'drive', 'dr', 'lane', 'ln', 'suite', 'ste', 'floor', 'fl', 'unit',
];

// CTA candidates
const CTA_PATTERNS = [
  'get a quote', 'book now', 'schedule', 'contact us', 'call now',
  'request estimate', 'make appointment', 'order online', 'view menu',
  'get started', 'learn more', 'sign up', 'register', 'subscribe',
  'book appointment', 'free consultation', 'get yours', 'shop now',
  'reserve', 'enroll', 'start', 'download', 'watch', 'explore',
];

// Social media domains
const SOCIAL_DOMAINS = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'x.com',
  'twitter.com', 'youtube.com', 'tiktok.com', 'yelp.com',
  'pinterest.com', 'reddit.com', 'tumblr.com', 'flickr.com',
];

// Booking domains
const BOOKING_DOMAINS = [
  'calendly', 'acuity', 'squareup', 'toasttab', 'opentable',
  'setmore', 'book', 'schedule', 'appointment', 'reserve',
  'timekit', ' appointing', 'bookwhen',
];

export function scoreLink(url: string, anchorText: string): number {
  const lowerUrl = url.toLowerCase();
  const lowerText = anchorText.toLowerCase();
  let score = 0;

  for (const kw of HIGH_PRIORITY_KEYWORDS) {
    if (lowerUrl.includes(kw) || lowerText.includes(kw)) {
      score += 10;
    }
  }

  for (const kw of SKIP_KEYWORDS) {
    if (lowerUrl.includes(kw) || lowerText.includes(kw)) {
      score -= 20;
    }
  }

  // Prefer shorter paths (likely not deeply nested)
  const pathDepth = url.split('/').filter(Boolean).length;
  score -= pathDepth * 2;

  return score;
}

function extractPhoneNumbers(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches)];
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches.filter(e => !e.includes('example')))];;
}

function extractAddresses(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10 && l.length < 200);
  const addresses: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const hasStreetWord = STREET_WORDS.some(w => lowerLine.includes(w));
    const hasNumber = /\d/.test(line);
    if (hasStreetWord && hasNumber) {
      addresses.push(line);
    }
  }

  return addresses;
}

function extractCTACandidates(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const pattern of CTA_PATTERNS) {
    if (lowerText.includes(pattern)) {
      found.push(pattern);
    }
  }

  return [...new Set(found)];
}

function extractServiceKeywords(h1: string[], h2: string[], h3: string[], text: string): string[] {
  const headings = [...h1, ...h2, ...h3];
  const keywords: string[] = [];

  for (const heading of headings) {
    // Extract short noun phrases (2-4 words)
    const words = heading.split(/\s+/).filter(w => w.length > 3);
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (!phrase.match(/^(the|and|for|with|our|your|this|that|are|was|has|have|been)/i)) {
        keywords.push(phrase);
      }
    }
  }

  // Deduplicate and filter noise
  return [...new Set(keywords)].slice(0, 20);
}

export function extractPageMetadata(html: string, url: string, deepFetch?: boolean): PageMetadata {
  const $ = cheerio.load(html);

  // Remove noisy elements
  $('script, style, noscript, svg, header, footer, nav, aside, form').remove();

  // Title
  const title = $('title').text().trim() || '';

  // Meta description
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

  // Canonical URL
  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim();

  // Headings
  const h1 = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2 = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h3 = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean);

  // Visible text
  let visibleText = $('body').text() || '';
  visibleText = visibleText.replace(/\s+/g, ' ').trim();

  // Collapse repeated lines
  const lines = visibleText.split('. ');
  const collapsedLines: string[] = [];
  let prevLine = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed !== prevLine && trimmed.length > 10) {
      collapsedLines.push(trimmed);
      prevLine = trimmed;
    }
  }
  visibleText = collapsedLines.join('. ');

  // Important text: title + meta + headings + first paragraph
  const importantTextParts = [
    title,
    metaDescription,
    ...h1,
    ...h2,
    ...h3,
    $('p').first().text().trim(),
  ].filter(Boolean);

  const importantText = importantTextParts.join(' | ').slice(0, 2000);

  // Links
  const internal: string[] = [];
  const external: string[] = [];
  const social: string[] = [];
  const phone: string[] = [];
  const email: string[] = [];

  const baseUrl = new URL(url).hostname.replace(/^www\./, '');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().toLowerCase();

    try {
      if (href.startsWith('tel:')) {
        phone.push(href.replace('tel:', ''));
        return;
      }
      if (href.startsWith('mailto:')) {
        email.push(href.replace('mailto:', ''));
        return;
      }
      if (href.startsWith('http')) {
        const linkUrl = new URL(href);
        const linkHost = linkUrl.hostname.replace(/^www\./, '');

        // Social link
        if (SOCIAL_DOMAINS.some(d => linkHost.includes(d))) {
          social.push(href);
          return;
        }

        // Booking link
        if (BOOKING_DOMAINS.some(d => href.toLowerCase().includes(d))) {
          external.push(href);
          return;
        }

        if (linkHost === baseUrl) {
          internal.push(href);
        } else {
          external.push(href);
        }
      } else if (href.startsWith('/')) {
        // Relative path
        internal.push(new URL(href, url).toString());
      }
    } catch {
      // ignore invalid URLs
    }
  });

  // Images with alt
  const images: { src: string; alt: string }[] = [];
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (src) {
      images.push({ src, alt });
    }
  });

  // JSON-LD structured data
  const structuredData: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        structuredData.push(JSON.parse(content));
      }
    } catch {
      // ignore invalid JSON
    }
  });

  // Business signals from visible text
  const phoneNumbers = extractPhoneNumbers(visibleText + ' ' + phone.join(' '));
  const emails = extractEmails(visibleText + ' ' + email.join(' '));
  const addresses = extractAddresses(visibleText);
  const ctaCandidates = extractCTACandidates(visibleText + ' ' + $('button, a').map((_, el) => $(el).text()).get().join(' '));
  const serviceKeywords = extractServiceKeywords(h1, h2, h3, visibleText);

  return {
    title,
    metaDescription,
    canonicalUrl,
    h1,
    h2,
    h3,
    visibleText,
    importantText,
    textLength: visibleText.length,
    links: {
      internal: [...new Set(internal)],
      external: [...new Set(external)],
      social: [...new Set(social)],
      phone: [...new Set(phone)],
      email: [...new Set(email)],
    },
    images,
    structuredData,
    businessSignals: {
      phoneNumbers,
      emails,
      addresses,
      ctaCandidates,
      serviceKeywords,
    },
    deepContent: deepFetch ? extractDeepContent(html) : undefined,
  };
}

function extractDeepContent(html: string): DeepContent {
  const $clone = cheerio.load(html);

  // Full text without removing content (but still cleaning scripts/styles)
  $clone('script, style').remove();
  const fullText = $clone('body').text().replace(/\s+/g, ' ').trim();

  // OG tags
  const ogTitle = $clone('meta[property="og:title"]').attr('content') || undefined;
  const ogDescription = $clone('meta[property="og:description"]').attr('content') || undefined;
  const ogImage = $clone('meta[property="og:image"]').attr('content') || undefined;
  const ogType = $clone('meta[property="og:type"]').attr('content') || undefined;

  // Meta keywords
  const metaKeywords = $clone('meta[name="keywords"]').attr('content') || '';

  // All image alt texts
  const altTexts: string[] = [];
  $clone('img[alt]').each((_, el) => {
    const alt = $clone(el).attr('alt') || '';
    if (alt.trim()) altTexts.push(alt.trim());
  });

  // Parse structured data by type
  const schemaData: Array<{ type: string; data: Record<string, unknown> }> = [];
  $clone('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $clone(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        const type = parsed['@type'] || parsed.type || 'Unknown';
        schemaData.push({ type: String(type), data: parsed });
      }
    } catch {
      // ignore
    }
  });

  // FAQ extraction (common patterns)
  const faqContent: Array<{ q: string; a: string }> = [];
  // Pattern 1: dl > dt/dd pairs
  $clone('dl.faq, dl[data-faq]').find('dt, dd').each((i, el) => {
    if (i % 2 === 0) {
      const q = $clone(el).text().trim();
      const a = $clone(el).next('dd').text().trim();
      if (q && a) faqContent.push({ q, a });
    }
  });
  // Pattern 2: FAQ accordion divs with question in h3/h4 and answer in p/div
  $clone('.faq, .accordion, [data-faq], .faq-item').each((_, el) => {
    const question = $clone(el).find('h2, h3, h4, .question, .q').first().text().trim();
    const answer = $clone(el).find('p, .answer, .a, .content').first().text().trim();
    if (question && answer && question.length > 5) {
      faqContent.push({ q: question, a: answer });
    }
  });

  // Hidden text (aria labels, data attributes, noscript content)
  const hiddenTextParts: string[] = [];
  $clone('[aria-label]').each((_, el) => {
    const label = $clone(el).attr('aria-label');
    if (label) hiddenTextParts.push(label);
  });
  $clone('[data-tooltip], [data-title]').each((_, el) => {
    const t = $clone(el).attr('data-tooltip') || $clone(el).attr('data-title');
    if (t) hiddenTextParts.push(t);
  });
  // Noscript text (often has useful content for JS-rendered sites)
  const $noscript = $clone('noscript');
  if ($noscript.length) {
    const nsText = $noscript.text().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (nsText.length > 20) hiddenTextParts.push(nsText);
  }

  return {
    fullText,
    ogTags: { ogTitle, ogDescription, ogImage, ogType },
    metaKeywords,
    schemaData,
    faqContent,
    altTexts: [...new Set(altTexts)],
    hiddenText: hiddenTextParts.join(' | '),
  };
}

export function extractLinks(html: string, baseUrl: string): { internal: string[]; external: string[] } {
  const $ = cheerio.load(html);
  const internal: string[] = [];
  const external: string[] = [];

  const baseHostname = new URL(baseUrl).hostname.replace(/^www\./, '');

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    try {
      if (href.startsWith('http')) {
        const linkUrl = new URL(href);
        const linkHost = linkUrl.hostname.replace(/^www\./, '');

        if (linkHost === baseHostname) {
          internal.push(href);
        } else {
          external.push(href);
        }
      } else if (href.startsWith('/')) {
        internal.push(new URL(href, baseUrl).toString());
      }
    } catch {
      // ignore
    }
  });

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}
import { normalizeUrl, isSameDomain, isInternalPath } from './normalizeUrl';
import { extractPageMetadata, scoreLink } from './extractMetadata';
import type { CrawledSite, CrawledPage, CrawlOptions, GlobalSignals } from './types';
import type { Browser } from 'puppeteer';
import { getCloneCrawlPromptLimits } from '@/lib/clone/crawlPromptLimits';

export type CrawlProgressEvent =
  | { type: 'page_discovered'; url: string }
  | { type: 'page_started'; url: string }
  | { type: 'page_done'; url: string; title?: string; statusCode?: number; textLength?: number }
  | { type: 'page_failed'; url: string; error: string }
  | { type: 'stage'; stage: string; message: string };

function defaultCrawlOptions(): CrawlOptions {
  const limits = getCloneCrawlPromptLimits();
  return {
    maxPages: limits.maxPages,
    maxConcurrency: 3,
    timeoutMs: 10000,
    maxCharsPerPage: limits.maxCharsPerPage,
    deepFetch: true,
  };
}

const DEFAULT_OPTIONS: CrawlOptions = defaultCrawlOptions();

const SOCIAL_DOMAINS = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'x.com',
  'twitter.com', 'youtube.com', 'tiktok.com', 'yelp.com',
  'pinterest.com', 'google.com/maps', 'maps.google.com',
];

const BOOKING_DOMAINS = [
  'calendly', 'acuity', 'squareup', 'toasttab', 'opentable',
  'setmore', 'book', 'schedule', 'appointment', 'timekit',
];

async function fetchPage(url: string, timeoutMs: number): Promise<{ html: string; contentType: string; statusCode: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebsiteMigrationAgent/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }

    const html = await response.text();
    return { html, contentType, statusCode: response.status };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

let headlessBrowser: Browser | null = null;

async function getHeadlessBrowser(): Promise<Browser> {
  try {
    if (headlessBrowser && headlessBrowser.connected) {
      // Test if the browser is still responsive
      const pages = await headlessBrowser.pages();
      if (pages.length >= 0) return headlessBrowser;
    }
  } catch {
    // Browser is in a bad state, discard it
    try { headlessBrowser?.disconnect(); } catch {}
    headlessBrowser = null;
  }

  const puppeteer = await import('puppeteer');
  headlessBrowser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  return headlessBrowser;
}

async function fetchPageWithHeadless(url: string, timeoutMs: number): Promise<{ html: string; contentType: string; statusCode: number } | null> {
  try {
    const browser = await getHeadlessBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });
    const html = await page.content();
    await page.close();
    return { html, contentType: 'text/html', statusCode: resp?.status() || 200 };
  } catch {
    return null;
  }
}

function aggregateGlobalSignals(pages: CrawledPage[]): GlobalSignals {
  const allPhoneNumbers = new Set<string>();
  const allEmails = new Set<string>();
  const allAddresses = new Set<string>();
  const allSocialLinks = new Set<string>();
  const mapLinks: string[] = [];
  const bookingLinks: string[] = [];
  const contactLinks: string[] = [];
  const allServiceKeywords = new Set<string>();
  const allCTACandidates = new Set<string>();
  const businessNameCandidates: string[] = [];

  for (const page of pages) {
    page.businessSignals.phoneNumbers.forEach(p => allPhoneNumbers.add(p));
    page.businessSignals.emails.forEach(e => allEmails.add(e));
    page.businessSignals.addresses.forEach(a => allAddresses.add(a));
    page.businessSignals.serviceKeywords.forEach(k => allServiceKeywords.add(k));
    page.businessSignals.ctaCandidates.forEach(c => allCTACandidates.add(c));

    for (const social of page.links.social) {
      allSocialLinks.add(social);
    }

    for (const link of page.links.external) {
      if (link.includes('maps.google.com') || link.includes('google.com/maps')) {
        mapLinks.push(link);
      }
    }

    for (const link of page.links.internal.concat(page.links.external)) {
      if (BOOKING_DOMAINS.some(d => link.toLowerCase().includes(d))) {
        bookingLinks.push(link);
      }
    }

    const contactKeywords = ['contact', 'about', 'location'];
    const urlLower = page.normalizedUrl.toLowerCase();
    if (contactKeywords.some(k => urlLower.includes(k))) {
      contactLinks.push(page.url);
    }

    if (page.title) {
      if (page === pages[0] && page.title.length < 60) {
        businessNameCandidates.unshift(page.title);
      } else if (page.title.length < 60) {
        businessNameCandidates.push(page.title);
      }
    }
  }

  return {
    businessNameCandidates: businessNameCandidates.slice(0, 5),
    phoneNumbers: [...allPhoneNumbers],
    emails: [...allEmails],
    addresses: [...allAddresses],
    socialLinks: [...allSocialLinks],
    mapLinks: [...new Set(mapLinks)],
    bookingLinks: [...new Set(bookingLinks)],
    contactLinks: [...new Set(contactLinks)],
    serviceKeywords: [...allServiceKeywords].slice(0, 30),
    ctaCandidates: [...allCTACandidates],
  };
}

export async function crawlWebsite(
  sourceUrl: string,
  options?: Partial<CrawlOptions>,
  onProgress?: (event: CrawlProgressEvent) => Promise<void> | void
): Promise<CrawledSite> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedSourceUrl = normalizeUrl(sourceUrl);
  const domain = new URL(normalizedSourceUrl).hostname.replace(/^www\./, '');

  const pages: CrawledPage[] = [];
  const warnings: string[] = [];
  const visitedUrls = new Set<string>();
  const discoveredInternalLinks: string[] = [];
  const skippedLinks: string[] = [];

  await onProgress?.({ type: 'page_started', url: normalizedSourceUrl });

  let homeResult = await fetchPage(normalizedSourceUrl, opts.timeoutMs);

  if (homeResult && opts.useHeadless) {
    const tempMeta = extractPageMetadata(homeResult.html, normalizedSourceUrl, false);
    if (tempMeta.textLength < 100) {
      homeResult = await fetchPageWithHeadless(normalizedSourceUrl, opts.timeoutMs);
    }
  }

  if (!homeResult) {
    warnings.push('fetch_failed:' + normalizedSourceUrl);
    return {
      sourceUrl,
      normalizedSourceUrl,
      domain,
      crawledAt: new Date().toISOString(),
      pages: [],
      siteSummary: {
        pageCount: 0,
        totalTextLength: 0,
        discoveredInternalLinks: 0,
        crawledInternalLinks: 0,
        skippedLinks,
      },
      globalSignals: aggregateGlobalSignals([]),
      warnings,
    };
  }

  const { html: homeHtml } = homeResult;

  if (!homeResult) {
    warnings.push('non_html_response:' + normalizedSourceUrl);
  }

  const homeMetadata = extractPageMetadata(homeHtml, normalizedSourceUrl, opts.deepFetch);
  visitedUrls.add(normalizedSourceUrl);

  await onProgress?.({ type: 'page_done', url: normalizedSourceUrl, title: homeMetadata.title, statusCode: homeResult.statusCode, textLength: homeMetadata.textLength });

  pages.push({
    url: normalizedSourceUrl,
    normalizedUrl: normalizedSourceUrl,
    canonicalUrl: homeMetadata.canonicalUrl,
    title: homeMetadata.title,
    metaDescription: homeMetadata.metaDescription,
    h1: homeMetadata.h1,
    h2: homeMetadata.h2,
    h3: homeMetadata.h3,
    visibleText: homeMetadata.visibleText.slice(0, opts.maxCharsPerPage),
    textLength: homeMetadata.textLength,
    links: homeMetadata.links,
    images: homeMetadata.images,
    structuredData: homeMetadata.structuredData,
    businessSignals: homeMetadata.businessSignals,
    deepContent: homeMetadata.deepContent,
  });

  const { internal: homeInternal } = homeMetadata.links;
  for (const link of homeInternal) {
    const normLink = normalizeUrl(link);
    if (isSameDomain(normLink, normalizedSourceUrl) && !visitedUrls.has(normLink) && isInternalPath(normLink)) {
      discoveredInternalLinks.push(normLink);
      await onProgress?.({ type: 'page_discovered', url: normLink });
    }
  }

  const scoredLinks = homeInternal.map(link => ({
    url: normalizeUrl(link),
    score: scoreLink(link, ''),
  }));

  for (const item of scoredLinks) {
    if (visitedUrls.has(item.url)) continue;
    try {
      const u = new URL(item.url);
      const pathText = u.pathname.replace(/[\/\-]/g, ' ');
      item.score += scoreLink(item.url, pathText);
    } catch {}
  }

  const sortedLinks = scoredLinks
    .filter(l => !visitedUrls.has(l.url) && isSameDomain(l.url, normalizedSourceUrl) && isInternalPath(l.url))
    .sort((a, b) => b.score - a.score)
    .map(l => l.url);

  const toCrawl = sortedLinks.slice(0, opts.maxPages - 1);
  let crawledInternalLinks = 0;

  async function crawlWithRetry(url: string, retries = 1): Promise<{ page: CrawledPage | null; statusCode?: number }> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      await onProgress?.({ type: 'page_started', url });
      let result = await fetchPage(url, opts.timeoutMs);
      if (!result && opts.useHeadless) {
        result = await fetchPageWithHeadless(url, opts.timeoutMs);
      }
      if (result) {
        const metadata = extractPageMetadata(result.html, url, opts.deepFetch);
        await onProgress?.({ type: 'page_done', url, title: metadata.title, statusCode: result.statusCode, textLength: metadata.textLength });
        return {
          page: {
            url,
            normalizedUrl: normalizeUrl(url),
            canonicalUrl: metadata.canonicalUrl,
            title: metadata.title,
            metaDescription: metadata.metaDescription,
            h1: metadata.h1,
            h2: metadata.h2,
            h3: metadata.h3,
            visibleText: metadata.visibleText.slice(0, opts.maxCharsPerPage),
            textLength: metadata.textLength,
            links: metadata.links,
            images: metadata.images,
            structuredData: metadata.structuredData,
            businessSignals: metadata.businessSignals,
            deepContent: metadata.deepContent,
          },
          statusCode: result.statusCode,
        };
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    await onProgress?.({ type: 'page_failed', url, error: 'All fetch attempts failed' });
    return { page: null };
  }

  for (let i = 0; i < toCrawl.length; i += opts.maxConcurrency) {
    const batch = toCrawl.slice(i, i + opts.maxConcurrency);
    const results = await Promise.all(batch.map(url => crawlWithRetry(url)));

    for (let j = 0; j < results.length; j++) {
      const { page, statusCode } = results[j];
      const url = batch[j];

      if (page) {
        visitedUrls.add(url);
        pages.push(page);
        crawledInternalLinks++;

        for (const link of page.links.internal) {
          const normLink = normalizeUrl(link);
          if (isSameDomain(normLink, normalizedSourceUrl) && !visitedUrls.has(normLink) && isInternalPath(normLink)) {
            if (!discoveredInternalLinks.includes(normLink)) {
              discoveredInternalLinks.push(normLink);
              await onProgress?.({ type: 'page_discovered', url: normLink });
            }
          }
        }
      } else {
        warnings.push('fetch_failed:' + url);
      }
    }
  }

  const totalSkipped = Math.max(0, discoveredInternalLinks.length - toCrawl.length);
  if (totalSkipped > 5) {
    warnings.push(`many_links_skipped:${totalSkipped}`);
  }

  if (pages.length === 1 && pages[0].textLength < 500) {
    warnings.push('limited_content');
  }

  if (pages.every(p => p.visibleText.length < 100)) {
    warnings.push('no_visible_text');
  }

  warnings.push('robots_not_checked');

  const totalTextLength = pages.reduce((sum, p) => sum + p.textLength, 0);

  return {
    sourceUrl,
    normalizedSourceUrl,
    domain,
    crawledAt: new Date().toISOString(),
    pages,
    siteSummary: {
      pageCount: pages.length,
      totalTextLength,
      discoveredInternalLinks: discoveredInternalLinks.length,
      crawledInternalLinks,
      skippedLinks,
    },
    globalSignals: aggregateGlobalSignals(pages),
    warnings,
  };
}
import type { CrawledSite } from '@/lib/crawler/types';
import { getCloneCrawlPromptLimits } from './crawlPromptLimits';

export interface CloneCrawlPromptInput {
  pageTitles: string[];
  pageTexts: string[];
  totalLength: number;
  warning?: string;
  signalsSummary: string;
}

const PRIORITY_KEYWORDS = [
  'service',
  'about',
  'contact',
  'pricing',
  'menu',
  'faq',
  'team',
  'attorney',
  'lawyer',
];

function buildSignalsSummary(crawlResult: CrawledSite): string {
  const { globalSignals, siteSummary } = crawlResult;
  return [
    `Site: ${crawlResult.normalizedSourceUrl}`,
    `Domain: ${crawlResult.domain}`,
    `Pages crawled: ${siteSummary.pageCount}`,
    '',
    `Business name candidates: ${globalSignals.businessNameCandidates.join(', ') || 'not detected'}`,
    `Phone numbers found: ${globalSignals.phoneNumbers.join(', ') || 'not detected'}`,
    `Emails found: ${globalSignals.emails.join(', ') || 'not detected'}`,
    `Addresses found: ${
      globalSignals.addresses.length > 0
        ? globalSignals.addresses.slice(0, 3).join(' | ')
        : 'not detected'
    }`,
    `Social links: ${
      globalSignals.socialLinks.length > 0
        ? globalSignals.socialLinks.slice(0, 5).join(', ')
        : 'none detected'
    }`,
    `Service keywords: ${globalSignals.serviceKeywords.slice(0, 15).join(', ') || 'not detected'}`,
    `CTA phrases: ${globalSignals.ctaCandidates.slice(0, 10).join(', ') || 'not detected'}`,
  ].join('\n');
}

function sortPages(crawlResult: CrawledSite) {
  return [...crawlResult.pages].sort((a, b) => {
    const aHigh = PRIORITY_KEYWORDS.some((k) => a.url.toLowerCase().includes(k));
    const bHigh = PRIORITY_KEYWORDS.some((k) => b.url.toLowerCase().includes(k));
    if (aHigh && !bHigh) return -1;
    if (!aHigh && bHigh) return 1;
    if (a.url === crawlResult.normalizedSourceUrl) return -1;
    if (b.url === crawlResult.normalizedSourceUrl) return 1;
    return 0;
  });
}

/** Build prioritized crawl excerpts for profile / factual extraction prompts. */
export function buildCloneCrawlPromptInput(
  crawlResult: CrawledSite,
  maxTotalChars?: number
): CloneCrawlPromptInput {
  const limits = getCloneCrawlPromptLimits();
  const cap = maxTotalChars ?? limits.maxProfilePromptChars;
  const perPageCap = limits.maxCharsPerPage;
  const signalsSummary = buildSignalsSummary(crawlResult);

  const pageTexts: string[] = [];
  const pageTitles: string[] = [];

  for (const page of sortPages(crawlResult)) {
    const headings = [...page.h1, ...page.h2, ...page.h3].filter(Boolean);
    const header = `[${page.url}] ${page.title || '(no title)'}`;
    const headingStr =
      headings.length > 0 ? `\nHeadings: ${headings.join(' > ')}` : '';
    const signalStr =
      page.businessSignals.phoneNumbers.length > 0 || page.businessSignals.emails.length > 0
        ? `\nContact on this page: ${page.businessSignals.phoneNumbers.join(', ')} ${page.businessSignals.emails.join(', ')}`
        : '';
    const text = header + headingStr + signalStr + '\n\n' + page.visibleText.slice(0, perPageCap);
    pageTexts.push(text);
    pageTitles.push(page.title || page.url);
  }

  const combined = signalsSummary + '\n\n' + pageTexts.join('\n\n');
  const totalLength = combined.length;

  if (totalLength <= cap) {
    return {
      pageTitles,
      pageTexts: [signalsSummary, ...pageTexts],
      totalLength,
      signalsSummary,
    };
  }

  const signalsLen = signalsSummary.length;
  const remaining = Math.max(500, cap - signalsLen - 100);
  const perPageLimit = Math.floor(remaining / Math.max(pageTexts.length, 1));
  const truncatedTexts = pageTexts.map((t) => t.slice(0, perPageLimit));

  return {
    pageTitles,
    pageTexts: [signalsSummary, ...truncatedTexts],
    totalLength: cap,
    warning: `Content truncated to ${cap} chars`,
    signalsSummary,
  };
}

/** Short crawl summary for plan agent context (page titles + excerpt lengths). */
export function buildCrawlSummaryForPlan(crawlResult: CrawledSite): string {
  const lines = crawlResult.pages.slice(0, 20).map((page) => {
    const headings = [...page.h1, ...page.h2].slice(0, 3).join(' > ');
    return `- ${page.title || page.url} (${page.visibleText.length} chars)${headings ? `: ${headings}` : ''}`;
  });
  return [
    `Source: ${crawlResult.normalizedSourceUrl}`,
    `Pages: ${crawlResult.siteSummary.pageCount}`,
    ...lines,
  ].join('\n');
}

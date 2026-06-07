'use client';

import { BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface CrawlPage {
  url: string;
  title?: string;
  status: 'queued' | 'crawling' | 'done' | 'failed' | 'skipped';
  statusCode?: number;
  textLength?: number;
  error?: string;
}

interface CrawlSummary {
  totalDiscovered: number;
  totalCrawled: number;
  totalSkipped: number;
  totalFailed: number;
}

interface Props {
  crawlPages: CrawlPage[];
  crawlSummary: CrawlSummary;
  stageLabel: string;
  elapsedFormatted: string;
}

function getPageIcon(status: CrawlPage['status']) {
  switch (status) {
    case 'done': return '✓';
    case 'crawling': return '◐';
    case 'failed': return '✗';
    case 'skipped': return '–';
    default: return '○';
  }
}

function getPageIconColor(status: CrawlPage['status']) {
  switch (status) {
    case 'done': return 'text-emerald-600';
    case 'crawling': return 'text-rose-500 animate-pulse';
    case 'failed': return 'text-red-500';
    case 'skipped': return 'text-yellow-500';
    default: return TEXT.tertiary;
  }
}

function formatChars(n?: number) {
  if (!n) return '–';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function CrawlProgressCard({ crawlPages, crawlSummary, stageLabel, elapsedFormatted }: Props) {
  const totalDone = crawlPages.filter(p => p.status === 'done').length;

  return (
    <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b flex items-center justify-between', SURFACE.alt, BORDER.hairline)}>
        <div>
          <h2 className={cn('font-medium text-sm', TEXT.primary)}>Pages Discovery</h2>
          <p className={cn('text-xs mt-0.5', TEXT.muted)}>{stageLabel}</p>
        </div>
        <div className="text-right">
          <div className={cn('text-xs', TEXT.muted)}>{totalDone}/{crawlSummary.totalDiscovered} crawled</div>
          <div className={cn('text-xs', TEXT.tertiary)}>{elapsedFormatted}</div>
        </div>
      </div>

      <div className={cn('px-4 py-2 border-b flex gap-4 text-xs', BORDER.hairline)}>
        <span className="text-emerald-600">✓ {crawlSummary.totalCrawled} done</span>
        <span className="text-yellow-500">– {crawlSummary.totalSkipped} skipped</span>
        <span className="text-red-500">✗ {crawlSummary.totalFailed} failed</span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {crawlPages.length === 0 && (
          <div className={cn('py-6 text-center text-sm', TEXT.tertiary)}>Discovering pages...</div>
        )}
        {crawlPages.map((page) => {
          const displayTitle = page.title
            ? page.title.slice(0, 40) + (page.title.length > 40 ? '…' : '')
            : new URL(page.url).pathname || '/';
          return (
            <div
              key={page.url}
              className={cn('flex items-center gap-2 px-4 py-1.5 border-b text-sm hover:bg-[#f5f5f7]', BORDER.hairline)}
            >
              <span className={cn('w-4 text-center text-sm', getPageIconColor(page.status))}>{getPageIcon(page.status)}</span>
              <span className={cn('flex-1 truncate', TEXT.primary)} title={page.title || page.url}>{displayTitle}</span>
              <span className={cn('text-xs font-mono', TEXT.tertiary)}>{new URL(page.url).pathname}</span>
              <span className={cn('text-xs w-10 text-right', TEXT.tertiary)}>{formatChars(page.textLength)}</span>
              <span className={cn(
                'text-xs w-8 text-right',
                page.statusCode === 200 ? 'text-emerald-600' : page.statusCode ? 'text-orange-500' : TEXT.tertiary
              )}>
                {page.statusCode || '–'}
              </span>
              {page.status === 'failed' && page.error && (
                <span className="text-red-400 text-xs" title={page.error}>⚠</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

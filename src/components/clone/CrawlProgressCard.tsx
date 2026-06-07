'use client';

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
    case 'done': return 'text-green-600';
    case 'crawling': return 'text-brand-500 animate-pulse';
    case 'failed': return 'text-red-500';
    case 'skipped': return 'text-yellow-500';
    default: return 'text-zinc-400';
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
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
        <div>
          <h2 className="font-medium text-zinc-800 text-sm">Pages Discovery</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{stageLabel}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">{totalDone}/{crawlSummary.totalDiscovered} crawled</div>
          <div className="text-xs text-zinc-400">{elapsedFormatted}</div>
        </div>
      </div>

      {/* Counters */}
      <div className="px-4 py-2 border-b border-zinc-100 flex gap-4 text-xs">
        <span className="text-green-600">✓ {crawlSummary.totalCrawled} done</span>
        <span className="text-yellow-500">– {crawlSummary.totalSkipped} skipped</span>
        <span className="text-red-500">✗ {crawlSummary.totalFailed} failed</span>
      </div>

      {/* Page list */}
      <div className="max-h-72 overflow-y-auto">
        {crawlPages.length === 0 && (
          <div className="py-6 text-center text-zinc-400 text-sm">Discovering pages...</div>
        )}
        {crawlPages.map((page) => {
          const displayTitle = page.title
            ? page.title.slice(0, 40) + (page.title.length > 40 ? '…' : '')
            : new URL(page.url).pathname || '/';
          return (
            <div key={page.url} className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-50 text-sm hover:bg-zinc-50">
              <span className={`w-4 text-center text-sm ${getPageIconColor(page.status)}`}>{getPageIcon(page.status)}</span>
              <span className="text-zinc-700 flex-1 truncate" title={page.title || page.url}>{displayTitle}</span>
              <span className="text-zinc-400 text-xs font-mono">{new URL(page.url).pathname}</span>
              <span className="text-zinc-400 text-xs w-10 text-right">{formatChars(page.textLength)}</span>
              <span className={`text-xs w-8 text-right ${page.statusCode === 200 ? 'text-green-500' : page.statusCode ? 'text-orange-500' : 'text-zinc-300'}`}>
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
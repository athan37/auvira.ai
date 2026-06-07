'use client';

import { BORDER, RADIUS, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface BuildSummaryItem {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  summary?: string;
  data?: {
    title?: string;
    count?: number;
    examples?: string[];
  };
}

interface BuildSummary {
  status: 'pending' | 'generating' | 'ready' | 'failed';
  items: BuildSummaryItem[];
}

interface Props {
  buildSummary?: BuildSummary | null;
  status: string;
}

function getIcon(status: BuildSummaryItem['status']) {
  switch (status) {
    case 'done': return '✓';
    case 'failed': return '✗';
    case 'running': return '◐';
    default: return '○';
  }
}

function getColor(status: BuildSummaryItem['status']) {
  switch (status) {
    case 'done': return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'failed': return 'text-red-600 bg-red-50 border-red-200';
    case 'running': return 'text-rose-600 bg-rose-50 border-rose-200';
    default: return cn(TEXT.tertiary, 'bg-[#f5f5f7] border-[#d2d2d7]/60');
  }
}

export default function LiveBuildSummaryCard({ buildSummary, status }: Props) {
  const items = buildSummary?.items || [];

  const shouldShow = status === 'preview_building' || status === 'preview_ready' || !!buildSummary;
  if (!shouldShow || items.length === 0) return null;

  return (
    <div className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)}>
      <div className={cn('px-4 py-3 border-b bg-rose-50/60', BORDER.hairline)}>
        <h2 className={cn('font-medium text-sm text-rose-900')}>Website draft being created</h2>
        <p className="text-xs text-rose-700 mt-0.5">
          We&apos;re turning the approved plan into a preview you can review and edit.
        </p>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => (
          <div key={item.key} className={cn('flex items-start gap-2 px-3 py-2 rounded-lg border', getColor(item.status))}>
            <span className="text-base w-5 text-center flex-shrink-0 mt-0.5">{getIcon(item.status)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              {item.summary && (
                <p className="text-xs mt-0.5 opacity-80">{item.summary}</p>
              )}
              {item.data?.examples && item.data.examples.length > 0 && item.status === 'done' && (
                <p className="text-xs mt-0.5 opacity-70">
                  {item.data.count && item.data.count > item.data.examples.length
                    ? `${item.data.count} total`
                    : ''}{' '}
                  {item.data.examples.join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

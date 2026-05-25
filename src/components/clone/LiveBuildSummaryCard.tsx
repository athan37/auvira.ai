'use client';

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
    case 'done': return 'text-green-600 bg-green-50 border-green-200';
    case 'failed': return 'text-red-600 bg-red-50 border-red-200';
    case 'running': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
    default: return 'text-gray-400 bg-gray-50 border-gray-200';
  }
}

export default function LiveBuildSummaryCard({ buildSummary, status }: Props) {
  const items = buildSummary?.items || [];
  const allDone = items.length > 0 && items.every(i => i.status === 'done' || i.status === 'pending');
  const hasRunning = items.some(i => i.status === 'running');

  // Show during preview_building, preview_ready, or when buildSummary exists
  const shouldShow = status === 'preview_building' || status === 'preview_ready' || !!buildSummary;
  if (!shouldShow || items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50">
        <h2 className="font-medium text-indigo-800 text-sm">Website draft being created</h2>
        <p className="text-xs text-indigo-600 mt-0.5">We're turning the approved plan into a preview you can review and edit.</p>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => (
          <div key={item.key} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${getColor(item.status)}`}>
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
                    : ''} {item.data.examples.join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
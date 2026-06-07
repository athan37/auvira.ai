'use client';

import { BORDER, RADIUS, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';

interface Log {
  timestamp: string;
  stage: string;
  message: string;
  data?: unknown;
}

interface Props {
  logs: Log[];
  defaultOpen?: boolean;
}

export default function CloneJobLogs({ logs, defaultOpen = false }: Props) {
  if (logs.length === 0) {
    return null;
  }

  return (
    <details className={cn('bg-white overflow-hidden border', RADIUS.card, BORDER.hairline)} open={defaultOpen}>
      <summary className={cn('px-4 py-3 border-b cursor-pointer hover:bg-[#ebebed]', SURFACE.alt, BORDER.hairline)}>
        <span className={cn('font-medium text-sm', TEXT.primary)}>Build logs</span>
        <span className={cn('text-xs ml-2', TEXT.tertiary)}>({logs.length} entries)</span>
      </summary>
      <div className="max-h-48 overflow-y-auto p-3 bg-[#1d1d1f]">
        {logs.map((log, i) => (
          <div key={i} className="text-xs font-mono text-[#f5f5f7] mb-1.5">
            <span className={TEXT.tertiary}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
            <span className="text-rose-400">[{log.stage}]</span> {log.message}
          </div>
        ))}
      </div>
    </details>
  );
}

'use client';

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
    <details className="bg-white rounded-xl border border-zinc-200 overflow-hidden" open={defaultOpen}>
      <summary className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 cursor-pointer hover:bg-zinc-100">
        <span className="font-medium text-zinc-700 text-sm">Build logs</span>
        <span className="text-xs text-zinc-400 ml-2">({logs.length} entries)</span>
      </summary>
      <div className="max-h-48 overflow-y-auto p-3 bg-zinc-900">
        {logs.map((log, i) => (
          <div key={i} className="text-xs font-mono text-zinc-300 mb-1.5">
            <span className="text-zinc-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
            <span className="text-brand-400">[{log.stage}]</span> {log.message}
          </div>
        ))}
      </div>
    </details>
  );
}
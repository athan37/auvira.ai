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
    <details className="bg-white rounded-xl border border-gray-200 overflow-hidden" open={defaultOpen}>
      <summary className="px-4 py-3 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100">
        <span className="font-medium text-gray-700 text-sm">Build logs</span>
        <span className="text-xs text-gray-400 ml-2">({logs.length} entries)</span>
      </summary>
      <div className="max-h-48 overflow-y-auto p-3 bg-gray-900">
        {logs.map((log, i) => (
          <div key={i} className="text-xs font-mono text-gray-300 mb-1.5">
            <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
            <span className="text-indigo-400">[{log.stage}]</span> {log.message}
          </div>
        ))}
      </div>
    </details>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export interface FileDiffResponse {
  ok: boolean;
  path?: string;
  status?: 'added' | 'modified' | 'deleted';
  patch?: string;
  beforeLineCount?: number;
  afterLineCount?: number;
  truncated?: boolean;
  afterMayBeStale?: boolean;
  error?: string;
}

interface Props {
  projectId: string;
  jobId: string;
  filePath: string;
  expanded: boolean;
}

function colorizePatchLine(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-zinc-500';
  if (line.startsWith('@@')) return 'text-blue-700';
  if (line.startsWith('+')) return 'text-emerald-800 bg-emerald-50';
  if (line.startsWith('-')) return 'text-red-800 bg-red-50';
  return 'text-zinc-700';
}

export function FileDiffViewer({ projectId, jobId, filePath, expanded }: Props) {
  const [data, setData] = useState<FileDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ jobId, path: filePath });
        const res = await fetch(
          `/api/projects/${projectId}/code-agent/diff/file?${params.toString()}`
        );
        const json = (await res.json()) as FileDiffResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData({ ok: false, error: 'Failed to load diff.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [expanded, projectId, jobId, filePath]);

  if (!expanded) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 pl-2 text-xs text-zinc-500">
        <Spinner size="sm" />
        Loading diff…
      </div>
    );
  }

  if (!data?.ok || !data.patch) {
    return (
      <p className="py-2 pl-2 text-xs text-red-600">
        {data?.error || 'Could not load code diff for this file.'}
      </p>
    );
  }

  const lines = data.patch.split('\n');

  return (
    <div className="mt-1 ml-1 border-l-2 border-zinc-200 pl-2 space-y-1">
      <p className="text-[10px] text-zinc-500">
        {data.status} · before {data.beforeLineCount ?? 0} lines → after{' '}
        {data.afterLineCount ?? 0} lines
        {data.truncated ? ' · diff truncated for display' : ''}
        {data.afterMayBeStale
          ? ' · after side is current workspace (may differ if you edited again)'
          : ''}
      </p>
      <pre className="text-[11px] leading-relaxed rounded-md border border-zinc-200 bg-zinc-50 p-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
        {lines.map((line, i) => (
          <div key={`${i}-${line.slice(0, 8)}`} className={colorizePatchLine(line)}>
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  );
}

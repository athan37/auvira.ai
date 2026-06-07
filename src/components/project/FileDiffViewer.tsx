'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Loading } from '@/components/ui/Loading';
import { BORDER, TEXT } from '@/content/productTheme';

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
  if (line.startsWith('+++') || line.startsWith('---')) return TEXT.muted;
  if (line.startsWith('@@')) return 'text-blue-700';
  if (line.startsWith('+')) return 'text-emerald-800 bg-emerald-50';
  if (line.startsWith('-')) return 'text-red-800 bg-red-50';
  return 'text-[#1d1d1f]';
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
      <div className={cn('flex items-center gap-2 py-3 pl-2 text-xs', TEXT.muted)}>
        <Loading size="sm" />
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
    <div className="mt-1 ml-1 border-l-2 border-[#d2d2d7]/80 pl-2 space-y-1">
      <p className={cn('text-[10px]', TEXT.muted)}>
        {data.status} · before {data.beforeLineCount ?? 0} lines → after{' '}
        {data.afterLineCount ?? 0} lines
        {data.truncated ? ' · diff truncated for display' : ''}
        {data.afterMayBeStale
          ? ' · after side is current workspace (may differ if you edited again)'
          : ''}
      </p>
      <pre
        className={cn(
          'text-[11px] leading-relaxed rounded-md p-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono bg-[#f5f5f7] border',
          BORDER.hairline
        )}
      >
        {lines.map((line, i) => (
          <div key={`${i}-${line.slice(0, 8)}`} className={colorizePatchLine(line)}>
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  );
}

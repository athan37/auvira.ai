'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';

type ObservabilityResponse = {
  ok: boolean;
  days?: number;
  observability?: {
    syncedCount: number;
    failedSyncCount: number;
    averageScore: number | null;
    gradeCounts: Record<string, number>;
    recentTurns: Array<{
      projectId: string;
      messageAt: string;
      grade?: string;
      overallScore?: number;
      externalId?: string;
      syncStatus: string;
      experimentVariant?: string;
      flowType?: string;
    }>;
  };
  edit?: {
    jobCount: number;
  };
  error?: string;
};

const PHOENIX_APP_URL =
  process.env.NEXT_PUBLIC_PHOENIX_APP_URL?.replace(/\/$/, '') ||
  'https://app.phoenix.arize.com';

/** Admin dashboard for Arize / Site Monitor turn scores. */
export default function AdminObservabilityPage() {
  const [data, setData] = useState<ObservabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/observability?days=7');
        const json = (await res.json()) as ObservabilityResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ok: false, error: 'Failed to load observability data' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const obs = data?.observability;

  return (
    <PageContainer className="py-10 max-w-5xl">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Observability</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Arize turn scores from Site Monitor (editor + clone flows). Filter Phoenix spans:{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">builder.turn</code>
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !data?.ok ? (
        <p className="text-sm text-red-700">{data?.error ?? 'Unauthorized or unavailable'}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Synced turns" value={String(obs?.syncedCount ?? 0)} />
            <StatCard label="Failed sync" value={String(obs?.failedSyncCount ?? 0)} />
            <StatCard
              label="Avg score"
              value={
                obs?.averageScore != null ? obs.averageScore.toFixed(2) : '—'
              }
            />
            <StatCard label="Edit jobs" value={String(data.edit?.jobCount ?? 0)} />
          </div>

          {obs?.gradeCounts && Object.keys(obs.gradeCounts).length > 0 ? (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-neutral-800 mb-2">Grade distribution</h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {Object.entries(obs.gradeCounts).map(([grade, count]) => (
                  <li key={grade} className="rounded-full bg-neutral-100 px-3 py-1">
                    {grade}: {count}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Recent turns</h2>
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Grade</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {(obs?.recentTurns ?? []).map((row) => (
                    <tr key={`${row.projectId}-${row.messageAt}`} className="border-t border-neutral-100">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/projects/${row.projectId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {row.projectId.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{row.grade ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.overallScore != null ? row.overallScore.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {row.experimentVariant ?? row.flowType ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.externalId ? (
                          <a
                            href={PHOENIX_APP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-mono"
                            title={row.externalId}
                          >
                            {row.externalId.slice(0, 12)}…
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-400">{row.syncStatus}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-neutral-900 mt-1">{value}</p>
    </div>
  );
}

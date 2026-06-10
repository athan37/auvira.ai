'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ObservabilityIntentProfilePanel } from '@/components/project/ObservabilityIntentProfilePanel';
import { ObservabilityLiveContextPanel } from '@/components/project/ObservabilityLiveContextPanel';
import { ObservabilityStatCards } from '@/components/project/ObservabilityStatCards';
import { ObservabilityTurnTable } from '@/components/project/ObservabilityTurnTable';
import { TEXT } from '@/content/productTheme';
import type { ProjectObservabilityTurnRow } from '@/lib/metrics/aggregateObservabilityMetrics';
import { gradeToBadgeTone, outcomeToBadgeTone } from '@/lib/observability/observabilityUiHelpers';
import type { MonitorDashboardView } from '@/lib/observability/parseMonitorDashboard';
import type { MonitorIntentProfileView } from '@/lib/observability/parseIntentProfile';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

type ProjectObservabilityResponse = {
  ok: boolean;
  projectId?: string;
  projectName?: string;
  days?: number;
  monitorEnabled?: boolean;
  summary?: {
    syncedCount: number;
    failedSyncCount: number;
    averageScore: number | null;
    gradeCounts: Record<string, number>;
    outcomeCounts: Record<string, number>;
    coachingAppliedCount: number;
    clarificationCount: number;
  };
  turns?: ProjectObservabilityTurnRow[];
  monitorDashboard?: MonitorDashboardView | null;
  intentProfile?: MonitorIntentProfileView | null;
  probeIntent?: { sentence: string; extractedColor: string | null } | null;
  liveContext?: {
    raw: Record<string, unknown>;
    parsed: ObservabilityCoachingContext;
  } | null;
  error?: string;
};

function ObservabilityDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-[#f5f5f7] animate-pulse h-20" />
        ))}
      </div>
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-2xl bg-[#f5f5f7] animate-pulse h-64" />
        <div className="lg:col-span-4 rounded-2xl bg-[#f5f5f7] animate-pulse h-64" />
      </div>
      <div className="rounded-2xl bg-[#f5f5f7] animate-pulse h-48" />
    </div>
  );
}

function ObservabilityDistributionCard({
  gradeCounts,
  outcomeCounts,
}: {
  gradeCounts?: Record<string, number>;
  outcomeCounts?: Record<string, number>;
}) {
  const hasGrades = gradeCounts && Object.keys(gradeCounts).length > 0;
  const hasOutcomes = outcomeCounts && Object.keys(outcomeCounts).length > 0;

  if (!hasGrades && !hasOutcomes) {
    return (
      <Card variant="glass" className="h-full">
        <CardHeader className="border-[#d2d2d7]/80">
          <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Distribution</h2>
        </CardHeader>
        <CardBody>
          <p className={`text-sm ${TEXT.muted}`}>No graded turns in this window yet.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Distribution</h2>
      </CardHeader>
      <CardBody className="space-y-5">
        {hasGrades ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
              Grades
            </h3>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(gradeCounts!).map(([grade, count]) => (
                <li key={grade}>
                  <Badge tone={gradeToBadgeTone(grade)}>
                    {grade}: {count}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasOutcomes ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
              Outcomes
            </h3>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(outcomeCounts!).map(([outcome, count]) => (
                <li key={outcome}>
                  <Badge tone={outcomeToBadgeTone(outcome)} className="capitalize">
                    {outcome}: {count}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Per-project observability dashboard content — stats, live context, turn history. */
export function ProjectObservabilityDashboard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectObservabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [probeMessage, setProbeMessage] = useState('change first section to red');
  const [probeInput, setProbeInput] = useState('change first section to red');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (probe?: string) => {
      const qs = new URLSearchParams({ days: '7' });
      if (probe?.trim()) qs.set('probeMessage', probe.trim());
      const res = await fetch(`/api/projects/${projectId}/observability?${qs.toString()}`);
      return (await res.json()) as ProjectObservabilityResponse;
    },
    [projectId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await load(probeMessage);
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
  }, [load, probeMessage]);

  const handleRefreshContext = async () => {
    setRefreshing(true);
    try {
      const json = await load(probeInput);
      setProbeMessage(probeInput);
      setData(json);
    } catch {
      setData({ ok: false, error: 'Failed to refresh context' });
    } finally {
      setRefreshing(false);
    }
  };

  const summary = data?.summary;
  const monitorCards = data?.monitorDashboard?.cards;
  const useMonitorStats = Boolean(
    data?.monitorEnabled && monitorCards && (monitorCards.turnCount ?? 0) > 0
  );

  return (
    <div className="px-3 lg:px-4 pb-8 max-w-5xl mx-auto w-full">
      <header className="py-6">
        <h1 className={`text-2xl font-semibold tracking-[-0.02em] ${TEXT.primary}`}>
          Observability
        </h1>
        <p className={`text-sm mt-1 ${TEXT.muted}`}>
          Site Monitor intent profile, coaching context, and Phoenix turn history
          {data?.days != null ? ` (last ${data.days} days)` : ''}.
        </p>
      </header>

      {loading ? (
        <ObservabilityDashboardSkeleton />
      ) : !data?.ok ? (
        <Alert variant="error">{data?.error ?? 'Unauthorized or unavailable'}</Alert>
      ) : (
        <div className="space-y-6">
          <ObservabilityStatCards
            cards={
              useMonitorStats
                ? [
                    {
                      label: 'Monitor turns',
                      value: String(monitorCards?.turnCount ?? 0),
                    },
                    {
                      label: 'Session grade',
                      value: monitorCards?.sessionGrade ?? '—',
                    },
                    {
                      label: 'Latest score',
                      value:
                        monitorCards?.latestScore != null
                          ? monitorCards.latestScore.toFixed(2)
                          : '—',
                    },
                    {
                      label: 'Top issue',
                      value: monitorCards?.topIssueLabel ?? monitorCards?.topIssue ?? '—',
                    },
                  ]
                : [
                    { label: 'Synced turns', value: String(summary?.syncedCount ?? 0) },
                    {
                      label: 'Avg score',
                      value:
                        summary?.averageScore != null ? summary.averageScore.toFixed(2) : '—',
                    },
                    { label: 'Clarifications', value: String(summary?.clarificationCount ?? 0) },
                    {
                      label: 'Coaching applied',
                      value: String(summary?.coachingAppliedCount ?? 0),
                    },
                  ]
            }
          />

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <ObservabilityIntentProfilePanel
                monitorEnabled={data.monitorEnabled ?? false}
                intentProfile={data.intentProfile}
              />
            </div>
            <div className="lg:col-span-7">
              <ObservabilityLiveContextPanel
                monitorEnabled={data.monitorEnabled ?? false}
                liveContext={data.liveContext}
                probeInput={probeInput}
                probeIntent={data.probeIntent}
                refreshing={refreshing}
                onProbeInputChange={setProbeInput}
                onRefresh={handleRefreshContext}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <ObservabilityTurnTable
                projectId={projectId}
                monitorEnabled={data.monitorEnabled}
                monitorTurns={data.monitorDashboard?.turns}
                mongoTurns={data.turns ?? []}
              />
            </div>
            <div className="lg:col-span-4">
              <ObservabilityDistributionCard
                gradeCounts={summary?.gradeCounts}
                outcomeCounts={summary?.outcomeCounts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

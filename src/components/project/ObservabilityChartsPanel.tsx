'use client';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import type { MonitorChartsView } from '@/lib/observability/parseMonitorDashboard';

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={TEXT.muted}>{label}</span>
        <span className={TEXT.primary}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
        <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Group 7 — charts from dashboard.charts (CSS/table, no chart library). */
export function ObservabilityChartsPanel({ charts }: { charts?: MonitorChartsView }) {
  if (!charts) {
    return (
      <Card variant="glass">
        <CardHeader className="border-[#d2d2d7]/80">
          <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Charts</h2>
        </CardHeader>
        <CardBody>
          <EmptyState title="No chart data" description="Analyze a session to load chart series." className="py-6" />
        </CardBody>
      </Card>
    );
  }

  const maxPareto = Math.max(...charts.issuePareto.map((row) => row.count), 1);
  const maxScore = Math.max(
    ...charts.scoreSeries.map((p) => p.overallScore ?? 0),
    0.01
  );

  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Charts</h2>
      </CardHeader>
      <CardBody className="space-y-6">
        {charts.scoreSeries.length > 0 ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${TEXT.tertiary}`}>
              Score over time
            </h3>
            <div className="flex items-end gap-1 h-24">
              {charts.scoreSeries.map((point) => {
                const h = ((point.overallScore ?? 0) / maxScore) * 100;
                return (
                  <div
                    key={point.turnIndex}
                    className="flex-1 min-w-[6px] rounded-t bg-rose-400/70"
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={`Turn ${point.turnIndex}: ${point.overallScore?.toFixed(2) ?? '—'} (${point.grade ?? ''})`}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {charts.issuePareto.length > 0 ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${TEXT.tertiary}`}>
              Issue breakdown
            </h3>
            <div className="space-y-2">
              {charts.issuePareto.map((row) => (
                <BarRow key={row.label} label={row.label} value={row.count} max={maxPareto} />
              ))}
            </div>
          </div>
        ) : null}

        {charts.gateFunnel ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
              Gate funnel
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className={TEXT.tertiary}>Total turns</dt>
              <dd className={TEXT.primary}>{charts.gateFunnel.totalTurns ?? '—'}</dd>
              <dt className={TEXT.tertiary}>Outcome success</dt>
              <dd className={TEXT.primary}>{charts.gateFunnel.outcomeSuccess ?? '—'}</dd>
              <dt className={TEXT.tertiary}>Verify pass</dt>
              <dd className={TEXT.primary}>{charts.gateFunnel.verifyPass ?? '—'}</dd>
              <dt className={TEXT.tertiary}>Build gate pass</dt>
              <dd className={TEXT.primary}>{charts.gateFunnel.buildGatePass ?? '—'}</dd>
            </dl>
          </div>
        ) : null}

        {Object.keys(charts.experimentBreakdown).length > 0 ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
              A/B coaching
            </h3>
            <ul className="space-y-1 text-xs">
              {Object.entries(charts.experimentBreakdown).map(([variant, count]) => (
                <li key={variant} className="flex justify-between">
                  <span className={TEXT.muted}>{variant}</span>
                  <span className={TEXT.primary}>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {charts.latency ? (
          <div>
            <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
              Latency (ms)
            </h3>
            <p className={`text-xs ${TEXT.muted}`}>
              avg {charts.latency.avg ?? '—'} · p50 {charts.latency.p50 ?? '—'} · min{' '}
              {charts.latency.min ?? '—'} · max {charts.latency.max ?? '—'}
              {charts.latencyDeltaFirstToLastMs != null
                ? ` · Δ ${charts.latencyDeltaFirstToLastMs}ms`
                : ''}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

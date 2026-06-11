'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TEXT } from '@/content/productTheme';
import type { MonitorExecutiveKpis } from '@/lib/observability/parseMonitorDashboard';

function formatPct(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

/** Group 5 — executive reliability KPIs (hidden when reliability_score is null). */
export function ObservabilityExecutivePanel({
  executiveKpis,
}: {
  executiveKpis?: MonitorExecutiveKpis | null;
}) {
  if (executiveKpis?.reliabilityScore == null) return null;

  const ops = executiveKpis.operations;
  const components = executiveKpis.reliabilityComponents;

  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Executive reliability</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Badge tone="info" className="text-sm px-3 py-1">
            Score {formatPct(executiveKpis.reliabilityScore)}
          </Badge>
          {executiveKpis.reliabilityGrade ? (
            <span className={`text-sm ${TEXT.muted}`}>
              Grade <span className={`font-medium ${TEXT.primary}`}>{executiveKpis.reliabilityGrade}</span>
            </span>
          ) : null}
          {executiveKpis.reliabilityStrong != null ? (
            <span className={`text-xs ${TEXT.tertiary}`}>
              Strong session: {executiveKpis.reliabilityStrong ? 'yes' : 'no'}
            </span>
          ) : null}
        </div>

        {components ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(['success', 'verify', 'build', 'recovery'] as const).map((key) => {
              const value = components[key];
              if (value == null) return null;
              return (
                <div key={key} className="glass-panel rounded-xl px-3 py-2">
                  <p className={`uppercase tracking-wide ${TEXT.tertiary}`}>{key}</p>
                  <p className={`text-lg font-semibold ${TEXT.primary}`}>{formatPct(value)}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        {ops ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            {ops.turnsToFirstSuccess != null ? (
              <>
                <dt className={TEXT.tertiary}>Turns to first success</dt>
                <dd className={TEXT.primary}>{ops.turnsToFirstSuccess}</dd>
              </>
            ) : null}
            {ops.meanRecoveryTurns != null ? (
              <>
                <dt className={TEXT.tertiary}>MTTR (turns)</dt>
                <dd className={TEXT.primary}>{ops.meanRecoveryTurns.toFixed(1)}</dd>
              </>
            ) : null}
            {ops.stabilityScore != null ? (
              <>
                <dt className={TEXT.tertiary}>Stability</dt>
                <dd className={TEXT.primary}>{formatPct(ops.stabilityScore)}</dd>
              </>
            ) : null}
            {ops.failureBlastRadius != null ? (
              <>
                <dt className={TEXT.tertiary}>Failure blast radius</dt>
                <dd className={TEXT.primary}>{ops.failureBlastRadius}</dd>
              </>
            ) : null}
            {ops.agentUptime != null ? (
              <>
                <dt className={TEXT.tertiary}>Agent uptime</dt>
                <dd className={TEXT.primary}>{formatPct(ops.agentUptime)}</dd>
              </>
            ) : null}
            {ops.sessionResolved != null ? (
              <>
                <dt className={TEXT.tertiary}>Session resolved</dt>
                <dd className={TEXT.primary}>{ops.sessionResolved ? 'yes' : 'no'}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </CardBody>
    </Card>
  );
}

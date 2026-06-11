'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import type { MonitorLearningMetrics } from '@/lib/observability/parseMonitorDashboard';

function formatScore(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

/** Group 6 — proof of improvement / learning metrics. */
export function ObservabilityLearningPanel({
  learningMetrics,
}: {
  learningMetrics?: MonitorLearningMetrics;
}) {
  if (!learningMetrics) {
    return (
      <Card variant="glass">
        <CardHeader className="border-[#d2d2d7]/80">
          <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Learning metrics</h2>
        </CardHeader>
        <CardBody>
          <EmptyState
            title="No learning metrics"
            description="Analyze a session with enough turns to populate learning KPIs."
            className="py-6"
          />
        </CardBody>
      </Card>
    );
  }

  const proof = learningMetrics.proofSummary ?? {};
  const coaching = learningMetrics.coachingEffectiveness ?? {};
  const adoption = learningMetrics.coachingAdoption;
  const recovery = learningMetrics.recovery;
  const decay = learningMetrics.issueDecay;

  return (
    <Card variant="glass">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Learning metrics</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {Object.keys(proof).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(proof).map(([key, active]) =>
              active ? (
                <li key={key}>
                  <Badge tone="success">{key.replace(/_/g, ' ')}</Badge>
                </li>
              ) : null
            )}
          </ul>
        ) : null}

        {Object.keys(coaching).length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {Object.entries(coaching).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className={`${TEXT.tertiary} truncate`}>{key.replace(/_/g, ' ')}</dt>
                <dd className={TEXT.primary}>{formatScore(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {learningMetrics.learningVelocitySlope != null ? (
            <>
              <dt className={TEXT.tertiary}>Learning velocity slope</dt>
              <dd className={TEXT.primary}>{formatScore(learningMetrics.learningVelocitySlope)}</dd>
            </>
          ) : null}
          {learningMetrics.timeToCompetencyTurnIndex != null ? (
            <>
              <dt className={TEXT.tertiary}>Time to competency (turn)</dt>
              <dd className={TEXT.primary}>{learningMetrics.timeToCompetencyTurnIndex}</dd>
            </>
          ) : null}
        </dl>

        {decay ? (
          <p className={`text-xs ${TEXT.muted}`}>
            Issue decay: {decay.firstHalfIssueCount ?? '—'} → {decay.secondHalfIssueCount ?? '—'}
            {decay.issueDecayDelta != null ? ` (Δ ${decay.issueDecayDelta})` : ''}
          </p>
        ) : null}

        {recovery ? (
          <p className={`text-xs ${TEXT.muted}`}>
            Recovery rate: {recovery.recoveryRate != null ? `${Math.round(recovery.recoveryRate * 100)}%` : '—'}
            {recovery.recoverySuccessCount != null
              ? ` (${recovery.recoverySuccessCount}/${recovery.recoveryEligibleTurns ?? '?'})`
              : ''}
          </p>
        ) : null}

        {adoption ? (
          <p className={`text-xs ${TEXT.muted}`}>
            Coaching adoption:{' '}
            {adoption.coachingAdoptionRate != null
              ? `${Math.round(adoption.coachingAdoptionRate * 100)}%`
              : '—'}
            {adoption.coachedTurnCount != null ? ` · ${adoption.coachedTurnCount} coached turns` : ''}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

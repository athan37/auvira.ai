'use client';

import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TEXT } from '@/content/productTheme';
import { gradeToBadgeTone } from '@/lib/observability/observabilityUiHelpers';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

export type ObservabilityLiveContext = {
  raw: Record<string, unknown>;
  parsed: ObservabilityCoachingContext;
};

/** Group 3 — live Site Monitor GET /context. */
export function ObservabilityLiveContextPanel({
  monitorEnabled,
  liveContext,
  analyzed,
}: {
  monitorEnabled: boolean;
  liveContext: ObservabilityLiveContext | null | undefined;
  analyzed?: boolean;
}) {
  const parsed = liveContext?.parsed;
  const quality = parsed?.qualitySnapshot;

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Live coaching context</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {!monitorEnabled ? (
          <EmptyState
            title="Monitor not configured"
            description="Enable Site Monitor to load coaching context."
            className="py-8"
          />
        ) : !analyzed ? (
          <EmptyState
            title="Not analyzed yet"
            description="Analyze a session to load coaching hints and missing keywords for the probe message."
            className="py-8"
          />
        ) : !liveContext ? (
          <EmptyState
            title="No context returned"
            description="Site Monitor did not return coaching context for this session."
            className="py-8"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              {quality?.latestGrade ? (
                <Badge tone={gradeToBadgeTone(quality.latestGrade)} className="text-sm px-3 py-1">
                  Grade {quality.latestGrade}
                </Badge>
              ) : null}
              {quality?.latestOverallScore != null ? (
                <span className={`text-sm ${TEXT.muted}`}>
                  Score{' '}
                  <span className={`font-medium ${TEXT.primary}`}>
                    {quality.latestOverallScore.toFixed(2)}
                  </span>
                </span>
              ) : null}
              {quality?.trend ? (
                <span className={`text-sm ${TEXT.muted}`}>
                  Trend <span className={`font-medium ${TEXT.primary}`}>{quality.trend}</span>
                </span>
              ) : null}
              <span className={`text-xs ${TEXT.tertiary}`}>
                Source: <span className={TEXT.primary}>{parsed?.source ?? '—'}</span>
              </span>
              {parsed?.traceCount != null ? (
                <span className={`text-xs ${TEXT.tertiary}`}>
                  Traces: <span className={TEXT.primary}>{parsed.traceCount}</span>
                </span>
              ) : null}
            </div>

            {parsed?.coachingHints && parsed.coachingHints.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Coaching hints
                </h3>
                <ol className="space-y-2">
                  {parsed.coachingHints.map((hint, i) => (
                    <li
                      key={`${i}-${hint.slice(0, 24)}`}
                      className="glass-panel rounded-xl px-3 py-2 text-sm text-[#1d1d1f] flex gap-2"
                    >
                      <span className={`shrink-0 font-medium ${TEXT.tertiary}`}>{i + 1}.</span>
                      <span>{hint}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className={`text-sm ${TEXT.muted}`}>No coaching hints yet. Normal on the first turn.</p>
            )}

            {parsed?.recurringIssues && parsed.recurringIssues.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Recurring issues
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {parsed.recurringIssues.map((issue) => (
                    <li key={issue}>
                      <Badge tone="warning">{issue}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {parsed?.missingKeywords && parsed.missingKeywords.length > 0 ? (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}>
                  Missing keywords (probe)
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {parsed.missingKeywords.map((kw) => (
                    <li key={kw}>
                      <Badge tone="default">{kw}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {parsed?.constraints && Object.keys(parsed.constraints).length > 0 ? (
              <details className="text-sm">
                <summary
                  className={`cursor-pointer text-xs font-semibold uppercase tracking-wide ${TEXT.tertiary}`}
                >
                  Constraints
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-[#f5f5f7] p-3 text-xs text-[#6e6e73]">
                  {JSON.stringify(parsed.constraints, null, 2)}
                </pre>
              </details>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

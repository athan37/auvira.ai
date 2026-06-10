'use client';

import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { TEXT } from '@/content/productTheme';
import { gradeToBadgeTone } from '@/lib/observability/observabilityUiHelpers';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

const INPUT_FOCUS =
  'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export type ObservabilityLiveContext = {
  raw: Record<string, unknown>;
  parsed: ObservabilityCoachingContext;
};

/** Live Site Monitor GET /context panel for the project observability dashboard. */
export function ObservabilityLiveContextPanel({
  monitorEnabled,
  liveContext,
  probeInput,
  probeIntent,
  refreshing,
  onProbeInputChange,
  onRefresh,
}: {
  monitorEnabled: boolean;
  liveContext: ObservabilityLiveContext | null | undefined;
  probeInput: string;
  probeIntent?: { sentence: string; extractedColor: string | null } | null;
  refreshing: boolean;
  onProbeInputChange: (value: string) => void;
  onRefresh: () => void;
}) {
  const parsed = liveContext?.parsed;
  const raw = liveContext?.raw;
  const quality = parsed?.qualitySnapshot as
    | { grade?: string; score?: number; trend?: string }
    | undefined;

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="border-[#d2d2d7]/80">
        <h2 className={`text-sm font-semibold ${TEXT.primary}`}>Live Site Monitor context</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {!monitorEnabled ? (
          <EmptyState
            title="Monitor not configured"
            description="Turn history below still loads from chat metadata when Site Monitor is disabled."
            className="py-8"
          />
        ) : !liveContext ? (
          <EmptyState
            title="No context returned"
            description="Site Monitor did not return coaching context for this project."
            className="py-8"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              {quality?.grade ? (
                <Badge tone={gradeToBadgeTone(quality.grade)} className="text-sm px-3 py-1">
                  Grade {quality.grade}
                </Badge>
              ) : null}
              {typeof quality?.score === 'number' ? (
                <span className={`text-sm ${TEXT.muted}`}>
                  Score <span className={`font-medium ${TEXT.primary}`}>{quality.score.toFixed(2)}</span>
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
              {typeof raw?.trace_count === 'number' ? (
                <span className={`text-xs ${TEXT.tertiary}`}>
                  Traces: <span className={TEXT.primary}>{raw.trace_count}</span>
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
            ) : null}

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

        <div className="pt-3 border-t border-[#d2d2d7]/60">
          <label
            htmlFor="observability-probe"
            className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${TEXT.tertiary}`}
          >
            Probe message
          </label>
          {probeIntent?.sentence ? (
            <div className="mb-3 rounded-xl border border-amber-100/90 bg-amber-50/50 px-3 py-2.5 text-sm">
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${TEXT.tertiary}`}>
                Monitor POST /intent
              </p>
              <p className={`text-sm ${TEXT.primary}`}>{probeIntent.sentence}</p>
              {probeIntent.extractedColor ? (
                <p className={`text-xs mt-1.5 ${TEXT.muted}`}>
                  Extracted color:{' '}
                  <Badge tone="warning" className="ml-1 capitalize">
                    {probeIntent.extractedColor}
                  </Badge>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="observability-probe"
              type="text"
              value={probeInput}
              onChange={(e) => onProbeInputChange(e.target.value)}
              className={INPUT_FOCUS}
              placeholder="e.g. change first section to red"
              disabled={!monitorEnabled}
            />
            <Button
              type="button"
              variant="primaryBlue"
              size="md"
              onClick={onRefresh}
              disabled={refreshing || !monitorEnabled}
              className="shrink-0"
            >
              {refreshing ? 'Refreshing…' : 'Refresh context'}
            </Button>
          </div>
          <p className={`text-xs mt-2 ${TEXT.tertiary}`}>
            Refreshes Site Monitor GET /context and POST /intent for the probe message.
          </p>
          {!monitorEnabled ? (
            <Alert variant="warning" className="mt-3 bg-[#f5f5f7] border-[#d2d2d7]/80 text-[#6e6e73]">
              Enable Site Monitor to probe live coaching context.
            </Alert>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

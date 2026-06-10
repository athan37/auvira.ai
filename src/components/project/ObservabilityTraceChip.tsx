'use client';

import type {
  ProjectMessageArizeMetadata,
  ProjectMessageObservabilityMetadata,
} from '@/lib/chat/projectMessageMetadata';
import { getIntentFeedView } from '@/lib/observability/formatCoachingSummary';

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_OBSERVABILITY_DEBUG === '1';
const PHOENIX_APP_URL =
  process.env.NEXT_PUBLIC_PHOENIX_APP_URL?.replace(/\/$/, '') ||
  'https://app.phoenix.arize.com';

function traceHref(externalId: string): string {
  const template = process.env.NEXT_PUBLIC_PHOENIX_TRACE_URL_TEMPLATE;
  if (template?.includes('{traceId}')) {
    return template.replace('{traceId}', encodeURIComponent(externalId));
  }
  return PHOENIX_APP_URL;
}

/** Intent sentence from Monitor POST /intent on assistant edit messages. */
export default function ObservabilityTraceChip({
  arize,
  observability,
}: {
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  outcome?: string;
  guidanceHints?: string[];
}) {
  const intentFeed = getIntentFeedView(observability);
  const intentLine = intentFeed?.panelLines[0]?.trim();
  const showDebug =
    DEBUG_ENABLED &&
    arize &&
    !(arize.syncStatus === 'pending' && !arize.externalId && !arize.grade);

  if (!intentLine && !showDebug) {
    return null;
  }

  const scoreLabel =
    arize?.grade != null && arize.overallScore != null
      ? `${arize.grade} · ${arize.overallScore.toFixed(2)}`
      : arize?.grade ?? (arize?.syncStatus === 'failed' ? 'sync failed' : null);

  return (
    <div className="mt-2 border-t border-black/5 pt-2 text-[11px] text-neutral-500">
      {intentLine ? (
        <p className="text-neutral-600">
          <span className="font-medium text-amber-800/90">Intent: </span>
          {intentLine}
        </p>
      ) : null}
      {showDebug ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {scoreLabel ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
              {scoreLabel}
            </span>
          ) : null}
          {arize?.externalId ? (
            <a
              href={traceHref(arize.externalId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline-offset-2 hover:underline"
              title={arize.externalId}
            >
              View trace
            </a>
          ) : null}
          {arize?.syncStatus === 'failed' && !arize.externalId ? (
            <span className="text-amber-700">Observability sync failed</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

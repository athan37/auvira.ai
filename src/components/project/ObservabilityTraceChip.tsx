'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
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

/** Intent sentence from Monitor POST /intent — click chip to open a floating panel. */
export default function ObservabilityTraceChip({
  arize,
  observability,
}: {
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  outcome?: string;
  guidanceHints?: string[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const intentFeed = getIntentFeedView(observability);
  const intentLines = (intentFeed?.panelLines ?? []).map((line) => line.trim()).filter(Boolean);
  const showDebug =
    DEBUG_ENABLED &&
    arize &&
    !(arize.syncStatus === 'pending' && !arize.externalId && !arize.grade);

  useEffect(() => {
    if (!panelOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [panelOpen]);

  if (intentLines.length === 0 && !showDebug) {
    return null;
  }

  const scoreLabel =
    arize?.grade != null && arize.overallScore != null
      ? `${arize.grade} · ${arize.overallScore.toFixed(2)}`
      : arize?.grade ?? (arize?.syncStatus === 'failed' ? 'sync failed' : null);

  return (
    <div className="mt-2 border-t border-black/5 pt-2 text-[11px] text-neutral-500">
      {intentLines.length > 0 ? (
        <div ref={anchorRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 font-medium',
              'bg-amber-50 text-amber-800/90 ring-1 ring-amber-200/80',
              'hover:bg-amber-100/80 transition-colors',
              panelOpen && 'ring-amber-300/90 bg-amber-100/90'
            )}
          >
            Intent
          </button>
          {panelOpen ? (
            <div
              id={panelId}
              role="dialog"
              aria-label="Site Monitor intent"
              className={cn(
                'absolute bottom-full left-0 z-30 mb-1.5 w-[min(17.5rem,78vw)]',
                'rounded-xl border border-amber-100/90 bg-white/95 shadow-lg backdrop-blur-sm',
                'px-3 py-2.5 text-[11px] leading-relaxed text-neutral-700'
              )}
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800/80">
                Intent
              </p>
              {intentLines.map((line, index) => (
                <p key={`${index}-${line.slice(0, 24)}`} className={index > 0 ? 'mt-1' : undefined}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
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

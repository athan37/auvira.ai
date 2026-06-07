'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ProjectMessageArizeMetadata,
  ProjectMessageObservabilityMetadata,
} from '@/lib/chat/projectMessageMetadata';
import { getMessageHintsView } from '@/lib/observability/formatCoachingSummary';

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

function HintPanel({
  label,
  hints,
  monitorHints,
  panelTitle,
}: {
  label: string;
  hints: string[];
  monitorHints?: string[];
  panelTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const hasPanelContent = hints.length > 0 || (monitorHints?.length ?? 0) > 0;

  if (!hasPanelContent) {
    return (
      <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-800 ring-1 ring-violet-100">
        {label}
      </span>
    );
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={`rounded-full px-2 py-0.5 font-medium text-violet-800 ring-1 ring-violet-100 transition-colors ${
          open ? 'bg-violet-100 ring-violet-200' : 'bg-violet-50 hover:bg-violet-100'
        }`}
      >
        {label}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={panelTitle}
          className="absolute bottom-full left-0 z-20 mb-1.5 w-72 max-w-[min(18rem,calc(100vw-2rem))] select-text rounded-lg border border-violet-100 bg-white p-2.5 text-left text-[11px] leading-snug text-neutral-700 shadow-lg"
        >
          {hints.length > 0 ? (
            <>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                {panelTitle}
              </p>
              <ul className="space-y-1.5">
                {hints.map((hint, index) => (
                  <li key={`${index}-${hint.slice(0, 24)}`} className="flex gap-1.5">
                    {hints.length > 1 ? (
                      <span className="mt-0.5 shrink-0 font-medium text-violet-600">
                        {index + 1}.
                      </span>
                    ) : null}
                    <span className="select-text">{hint}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {monitorHints && monitorHints.length > 0 ? (
            <div className={hints.length > 0 ? 'mt-2 border-t border-violet-50 pt-2' : undefined}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                From recent edits
              </p>
              <ul className="space-y-1.5">
                {monitorHints.map((hint, index) => (
                  <li key={`m-${index}-${hint.slice(0, 24)}`} className="select-text text-neutral-600">
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

/** Hints badge + optional debug trace footer on assistant messages. */
export default function ObservabilityTraceChip({
  arize,
  observability,
  guidanceHints,
}: {
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  outcome?: string;
  guidanceHints?: string[];
}) {
  const messageHints = getMessageHintsView(guidanceHints, observability);
  const showDebug =
    DEBUG_ENABLED &&
    arize &&
    !(arize.syncStatus === 'pending' && !arize.externalId && !arize.grade);

  if (!messageHints && !showDebug) return null;

  const scoreLabel =
    arize?.grade != null && arize.overallScore != null
      ? `${arize.grade} · ${arize.overallScore.toFixed(2)}`
      : arize?.grade ?? (arize?.syncStatus === 'failed' ? 'sync failed' : null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2 text-[11px] text-neutral-500">
      {messageHints ? (
        <HintPanel
          label={messageHints.label}
          hints={messageHints.hints}
          monitorHints={messageHints.monitorHints}
          panelTitle={messageHints.hints.length === 1 ? 'Hint' : 'Hints'}
        />
      ) : null}
      {showDebug && scoreLabel ? (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
          {scoreLabel}
        </span>
      ) : null}
      {showDebug && arize?.externalId ? (
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
      {showDebug && arize?.syncStatus === 'failed' && !arize.externalId ? (
        <span className="text-amber-700">Observability sync failed</span>
      ) : null}
    </div>
  );
}

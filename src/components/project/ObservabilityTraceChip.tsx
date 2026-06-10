'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  ProjectMessageArizeMetadata,
  ProjectMessageObservabilityMetadata,
} from '@/lib/chat/projectMessageMetadata';
import {
  getIntentFeedView,
  getMonitorContextView,
  getProjectMemoryView,
  getTipsView,
} from '@/lib/observability/formatCoachingSummary';

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

function ContextSection({
  title,
  lines,
  className,
}: {
  title: string;
  lines: string[];
  className?: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div className={className}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <ul className="space-y-1.5">
        {lines.map((line, index) => (
          <li key={`${title}-${index}-${line.slice(0, 24)}`} className="select-text text-neutral-600">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TracePopoverChip({
  label,
  panelTitle,
  lines,
  monitorHints,
  tone,
}: {
  label: string;
  panelTitle: string;
  lines: string[];
  monitorHints?: string[];
  tone: 'sky' | 'violet' | 'amber' | 'teal';
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

  const toneClasses =
    tone === 'sky'
      ? {
          badge: 'bg-sky-50 text-sky-800 ring-sky-100',
          badgeOpen: 'bg-sky-100 ring-sky-200',
          badgeHover: 'hover:bg-sky-100',
          border: 'border-sky-100',
          heading: 'text-sky-700',
          divider: 'border-sky-50',
          accent: 'text-sky-600',
        }
      : tone === 'amber'
        ? {
            badge: 'bg-amber-50 text-amber-900 ring-amber-100',
            badgeOpen: 'bg-amber-100 ring-amber-200',
            badgeHover: 'hover:bg-amber-100',
            border: 'border-amber-100',
            heading: 'text-amber-800',
            divider: 'border-amber-50',
            accent: 'text-amber-700',
          }
        : tone === 'teal'
          ? {
              badge: 'bg-teal-50 text-teal-900 ring-teal-100',
              badgeOpen: 'bg-teal-100 ring-teal-200',
              badgeHover: 'hover:bg-teal-100',
              border: 'border-teal-100',
              heading: 'text-teal-800',
              divider: 'border-teal-50',
              accent: 'text-teal-700',
            }
          : {
          badge: 'bg-violet-50 text-violet-800 ring-violet-100',
          badgeOpen: 'bg-violet-100 ring-violet-200',
          badgeHover: 'hover:bg-violet-100',
          border: 'border-violet-100',
          heading: 'text-violet-700',
          divider: 'border-violet-50',
          accent: 'text-violet-600',
        };

  const hasPanelContent = lines.length > 0 || (monitorHints?.length ?? 0) > 0;

  if (!hasPanelContent) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 font-medium ring-1 ${toneClasses.badge}`}
      >
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
        className={`rounded-full px-2 py-0.5 font-medium ring-1 transition-colors ${toneClasses.badge} ${
          open
            ? `${toneClasses.badgeOpen}`
            : `${toneClasses.badgeHover}`
        }`}
      >
        {label}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={panelTitle}
          className={`absolute bottom-full left-0 z-20 mb-1.5 w-72 max-w-[min(18rem,calc(100vw-2rem))] select-text rounded-lg border ${toneClasses.border} bg-white p-2.5 text-left text-[11px] leading-snug text-neutral-700 shadow-lg`}
        >
          {lines.length > 0 ? (
            <>
              <p
                className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses.heading}`}
              >
                {panelTitle}
              </p>
              <ul className="space-y-1.5">
                {lines.map((line, index) => (
                  <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-1.5">
                    {lines.length > 1 ? (
                      <span className={`mt-0.5 shrink-0 font-medium ${toneClasses.accent}`}>
                        {index + 1}.
                      </span>
                    ) : null}
                    <span className="select-text">{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {monitorHints && monitorHints.length > 0 ? (
            <ContextSection
              title="From recent edits"
              lines={monitorHints}
              className={
                lines.length > 0 ? `mt-2 border-t ${toneClasses.divider} pt-2` : undefined
              }
            />
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

function contextDetailCount(input: {
  projectMemory: ReturnType<typeof getProjectMemoryView>;
  intentFeed: ReturnType<typeof getIntentFeedView>;
  monitorContext: ReturnType<typeof getMonitorContextView>;
  tips: ReturnType<typeof getTipsView>;
}): number {
  return [
    input.monitorContext,
    input.intentFeed,
    input.projectMemory,
    input.tips,
  ].filter(Boolean).length;
}

/** Project Memory + Tips badges and optional debug trace footer on assistant messages. */
export default function ObservabilityTraceChip({
  arize,
  observability,
  outcome,
  guidanceHints,
}: {
  arize?: ProjectMessageArizeMetadata;
  observability?: ProjectMessageObservabilityMetadata;
  outcome?: string;
  guidanceHints?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const projectMemory = getProjectMemoryView(outcome, observability);
  const intentFeed = getIntentFeedView(observability);
  const monitorContext = getMonitorContextView(observability);
  const tips = getTipsView(outcome, guidanceHints, observability);
  const showDebug =
    DEBUG_ENABLED &&
    arize &&
    !(arize.syncStatus === 'pending' && !arize.externalId && !arize.grade);

  if (!projectMemory && !intentFeed && !monitorContext && !tips && !showDebug) {
    return null;
  }

  const detailCount = contextDetailCount({
    projectMemory,
    intentFeed,
    monitorContext,
    tips,
  });

  const scoreLabel =
    arize?.grade != null && arize.overallScore != null
      ? `${arize.grade} · ${arize.overallScore.toFixed(2)}`
      : arize?.grade ?? (arize?.syncStatus === 'failed' ? 'sync failed' : null);

  const toggleLabel =
    detailCount > 0
      ? expanded
        ? 'Hide context'
        : `View context (${detailCount})`
      : expanded
        ? 'Hide debug'
        : 'View debug';

  return (
    <div className="mt-2 border-t border-black/5 pt-2 text-[11px] text-neutral-500">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="text-left font-medium text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-700 hover:underline"
      >
        {toggleLabel}
      </button>
      {expanded ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {monitorContext ? (
            <TracePopoverChip
              label={monitorContext.label}
              panelTitle="GET /context"
              lines={monitorContext.panelLines}
              tone="teal"
            />
          ) : null}
          {intentFeed ? (
            <TracePopoverChip
              label={intentFeed.label}
              panelTitle="GET /intent"
              lines={intentFeed.panelLines}
              tone="amber"
            />
          ) : null}
          {projectMemory ? (
            <TracePopoverChip
              label={projectMemory.label}
              panelTitle="Applied memory"
              lines={projectMemory.panelLines}
              tone="sky"
            />
          ) : null}
          {tips ? (
            <TracePopoverChip
              label={tips.label}
              panelTitle={tips.hints.length === 1 ? 'Tip' : 'Tips'}
              lines={tips.hints}
              monitorHints={tips.monitorHints}
              tone="violet"
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
      ) : null}
    </div>
  );
}

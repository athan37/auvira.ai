'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  formatPreviewTargetChipText,
  formatPreviewTargetLabel,
  type PreviewTargetChipVariant,
} from '@/lib/preview/previewTargetChipLabels';
import {
  activatePreviewTargetChip,
  handlePreviewTargetChipKeyDown,
} from '@/lib/preview/previewTargetChipInteractions';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

interface Props {
  target: SelectedTargetInput;
  variant: PreviewTargetChipVariant;
  interactive?: boolean;
  active?: boolean;
  pulseKey?: number;
  onClear?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onActivate?: () => void;
  refocusInput?: () => void;
  className?: string;
}

function TargetPinIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-blue-700"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
      />
    </svg>
  );
}

function chipSurfaceClass(options: {
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  className?: string;
}): string {
  return cn(
    'items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs text-blue-900 transition-colors',
    options.interactive
      ? options.active
        ? 'cursor-pointer border-blue-600 bg-blue-100 ring-2 ring-blue-400/50 shadow-sm'
        : 'cursor-pointer border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 hover:shadow-sm'
      : 'border-blue-200 bg-blue-50',
    options.pulsing && 'ring-2 ring-blue-400 ring-offset-1',
    options.className
  );
}

/** Shared chip for pinned (active) and used (historical) preview edit targets. */
export function PreviewTargetChip({
  target,
  variant,
  interactive = false,
  active = false,
  pulseKey = 0,
  onClear,
  onHoverStart,
  onHoverEnd,
  onActivate,
  refocusInput,
  className,
}: Props) {
  const [pulsing, setPulsing] = useState(false);
  const label = formatPreviewTargetLabel(target);
  const chipText = formatPreviewTargetChipText(target, variant);
  const canActivate = interactive && Boolean(onActivate);

  useEffect(() => {
    if (pulseKey <= 0) return;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 1200);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  const activate = () => {
    activatePreviewTargetChip({ onActivate, refocusInput });
  };

  const body = (
    <>
      <TargetPinIcon />
      <span className="shrink-0 font-medium text-blue-800">
        {variant === 'pinned' ? 'Pinned:' : 'Used:'}
      </span>
      <span className="truncate" title={label}>
        {formatPreviewTargetLabel(target)}
      </span>
    </>
  );

  if (variant === 'pinned' && onClear) {
    return (
      <div
        data-section-chat-label
        className={cn(
          'mb-1 flex w-full gap-1',
          chipSurfaceClass({ interactive, active, pulsing, className: cn('flex', className) })
        )}
      >
        {canActivate ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            title={`Show ${label} in preview`}
            aria-label={`${chipText}. Show in preview.`}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onClick={activate}
            onKeyDown={(event) =>
              handlePreviewTargetChipKeyDown(event, onActivate, refocusInput)
            }
          >
            {body}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-live="polite">
            {body}
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          className="shrink-0 rounded p-0.5 text-blue-800 hover:bg-blue-100"
          aria-label={`Clear pinned target ${label}`}
          title="Clear selection"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      data-section-chat-label
      className={cn('inline-flex max-w-full', chipSurfaceClass({ interactive, active, pulsing, className }))}
      title={interactive ? `Show ${label} in preview` : chipText}
      aria-label={canActivate ? `${chipText}. Show in preview.` : chipText}
      role={canActivate ? 'button' : undefined}
      tabIndex={canActivate ? 0 : undefined}
      onMouseEnter={interactive ? onHoverStart : undefined}
      onMouseLeave={interactive ? onHoverEnd : undefined}
      onClick={canActivate ? activate : undefined}
      onKeyDown={
        canActivate
          ? (event) => handlePreviewTargetChipKeyDown(event, onActivate, refocusInput)
          : undefined
      }
    >
      {body}
    </div>
  );
}

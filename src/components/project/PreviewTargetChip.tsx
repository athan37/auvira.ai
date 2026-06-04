'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import {
  formatPreviewTargetBreadcrumb,
  formatPreviewTargetChipText,
  formatPreviewTargetDisplay,
  formatPreviewTargetLabel,
  type PreviewTargetChipVariant,
} from '@/lib/preview/previewTargetChipLabels';
import {
  activatePreviewTargetChip,
  handlePreviewTargetChipKeyDown,
} from '@/lib/preview/previewTargetChipInteractions';
import {
  elementKindIconName,
  type ElementKindIconName,
} from '@/lib/preview/previewTargetVisuals';
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

function ElementKindIcon({
  kind,
  className = 'h-3.5 w-3.5',
}: {
  kind: ElementKindIconName;
  className?: string;
}) {
  const cls = cn('shrink-0 text-zinc-500', className);
  switch (kind) {
    case 'button':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="8" width="16" height="8" rx="4" strokeWidth={2} />
        </svg>
      );
    case 'heading':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeWidth={2} d="M6 6h12M6 12h8M6 18h10" />
        </svg>
      );
    case 'contact_field':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      );
    case 'item_title':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={2} />
        </svg>
      );
    case 'item_body':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeWidth={2} d="M6 8h12M6 12h12M6 16h8" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h10"
          />
        </svg>
      );
  }
}

function ClearPinButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
      aria-label={`Clear pinned target ${label}`}
      title="Clear selection"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function TargetCardHeader({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Edit target
      </span>
      <ClearPinButton label={label} onClear={onClear} />
    </div>
  );
}

function TargetSectionRow({
  scopeLabel,
  title,
}: {
  scopeLabel: string;
  title: string;
}) {
  const showTitle = title.toLowerCase() !== scopeLabel.toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="info" className="shrink-0">
        {scopeLabel}
      </Badge>
      {showTitle ? (
        <span className="text-sm font-semibold text-zinc-950 break-words">{title}</span>
      ) : null}
    </div>
  );
}

function TargetElementRow({
  kind,
  label,
}: {
  kind?: string;
  label: string;
}) {
  const iconKind = elementKindIconName(kind);
  return (
    <div className="flex items-start gap-2 pl-3">
      <span className="mt-2 text-zinc-300 select-none" aria-hidden>
        ⌞
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pt-0.5">
        <ElementKindIcon kind={iconKind} />
        <span className="text-sm text-zinc-700 break-words">{label}</span>
      </div>
    </div>
  );
}

function pinnedCardSurfaceClass(options: {
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  className?: string;
}): string {
  return cn(
    'w-full rounded-lg border border-zinc-200/80 border-l-[3px] border-l-blue-500 bg-white shadow-sm transition-colors',
    options.interactive &&
      (options.active
        ? 'cursor-pointer ring-2 ring-blue-400/40 ring-offset-1'
        : 'cursor-pointer hover:border-zinc-300 hover:shadow'),
    options.pulsing && 'ring-2 ring-blue-400/50 ring-offset-1',
    options.className
  );
}

function PinnedTargetCard({
  target,
  interactive,
  active,
  pulsing,
  onClear,
  onHoverStart,
  onHoverEnd,
  onActivate,
  refocusInput,
  className,
}: {
  target: SelectedTargetInput;
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  onClear: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onActivate?: () => void;
  refocusInput?: () => void;
  className?: string;
}) {
  const display = formatPreviewTargetDisplay(target);
  const label = formatPreviewTargetLabel(target);
  const chipText = formatPreviewTargetChipText(target, 'pinned');
  const canActivate = interactive && Boolean(onActivate);

  const activate = () => {
    activatePreviewTargetChip({ onActivate, refocusInput });
  };

  const body = (
    <div className="space-y-2 pt-2">
      <TargetSectionRow scopeLabel={display.scopeLabel} title={display.title} />
      {display.element ? (
        <TargetElementRow kind={display.element.kind} label={display.element.label} />
      ) : null}
      <p className="text-[11px] text-zinc-500 pt-0.5">
        Describe what to change in the box below
      </p>
    </div>
  );

  return (
    <div
      data-section-chat-label
      className={cn('mb-2', pinnedCardSurfaceClass({ interactive, active, pulsing, className }))}
    >
      <div className="px-3 pt-2">
        <TargetCardHeader onClear={onClear} label={label} />
      </div>
      {canActivate ? (
        <button
          type="button"
          className="block w-full px-3 pb-3 text-left"
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
        <div className="px-3 pb-3" aria-live="polite">
          {body}
        </div>
      )}
    </div>
  );
}

function UsedTargetPill({
  target,
  interactive,
  active,
  pulsing,
  onHoverStart,
  onHoverEnd,
  onActivate,
  refocusInput,
  className,
}: {
  target: SelectedTargetInput;
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onActivate?: () => void;
  refocusInput?: () => void;
  className?: string;
}) {
  const label = formatPreviewTargetLabel(target);
  const breadcrumb = formatPreviewTargetBreadcrumb(target);
  const chipText = formatPreviewTargetChipText(target, 'used');
  const canActivate = interactive && Boolean(onActivate);

  const activate = () => {
    activatePreviewTargetChip({ onActivate, refocusInput });
  };

  return (
    <div
      data-section-chat-label
      className={cn(
        'inline-flex max-w-full items-center rounded-md border border-zinc-200/80 bg-zinc-100 px-2 py-1 text-xs text-zinc-800 transition-colors',
        interactive &&
          (active
            ? 'cursor-pointer ring-2 ring-zinc-400/50 ring-offset-1'
            : 'cursor-pointer hover:bg-zinc-200/80'),
        pulsing && 'ring-2 ring-zinc-400/50 ring-offset-1',
        className
      )}
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
      <span className="min-w-0 break-words whitespace-normal font-medium">{breadcrumb}</span>
    </div>
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

  useEffect(() => {
    if (pulseKey <= 0) return;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 1200);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  if (variant === 'pinned' && onClear) {
    return (
      <PinnedTargetCard
        target={target}
        interactive={interactive}
        active={active}
        pulsing={pulsing}
        onClear={onClear}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        onActivate={onActivate}
        refocusInput={refocusInput}
        className={className}
      />
    );
  }

  return (
    <UsedTargetPill
      target={target}
      interactive={interactive}
      active={active}
      pulsing={pulsing}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onActivate={onActivate}
      refocusInput={refocusInput}
      className={className}
    />
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { BORDER, CONTROL, TEXT } from '@/content/productTheme';
import {
  formatPreviewTargetBreadcrumb,
  formatPreviewTargetChipText,
  formatPreviewTargetLabel,
  type PreviewTargetChipVariant,
} from '@/lib/preview/previewTargetChipLabels';
import {
  activatePreviewTargetChip,
  handlePreviewTargetChipKeyDown,
} from '@/lib/preview/previewTargetChipInteractions';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { PreviewTargetThumbnail } from '@/components/project/PreviewTargetThumbnail';
import {
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';

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

function ClearPinButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      className={cn('shrink-0 rounded-lg p-1 btn-icon h-7 w-7', TEXT.tertiary, 'hover:text-[#1d1d1f]')}
      aria-label={`Clear pinned target ${label}`}
      title="Clear selection"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function targetPillSurfaceClass(options: {
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  fullWidth?: boolean;
  className?: string;
}): string {
  return cn(
    'items-center gap-2 rounded-xl px-2 py-1 text-xs transition-colors',
    options.fullWidth ? 'flex w-full min-w-0' : 'inline-flex max-w-full',
    CONTROL.chip,
    TEXT.primary,
    options.interactive &&
      (options.active
        ? 'cursor-pointer ring-2 ring-rose-400/50 ring-offset-1'
        : 'cursor-pointer hover:bg-rose-50/60'),
    options.pulsing && 'ring-2 ring-rose-400/50 ring-offset-1',
    options.className
  );
}

/** Compact pill row — same thumbnail size as chat history (`variant="pill"`). */
function TargetPillRow({
  target,
  chipVariant,
  interactive,
  active,
  pulsing,
  fullWidth = false,
  onHoverStart,
  onHoverEnd,
  onActivate,
  refocusInput,
  className,
}: {
  target: SelectedTargetInput;
  chipVariant: PreviewTargetChipVariant;
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  fullWidth?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onActivate?: () => void;
  refocusInput?: () => void;
  className?: string;
}) {
  const label = formatPreviewTargetLabel(target);
  const breadcrumb = formatPreviewTargetBreadcrumb(target);
  const chipText = formatPreviewTargetChipText(target, chipVariant);
  const canActivate = interactive && Boolean(onActivate);
  const showTargetPreview = Boolean(
    target.previewThumbnail?.previewUrl ||
      target.previewThumbnailDataUrl ||
      targetPreviewFallbackLabel(target)
  );

  const activate = () => {
    activatePreviewTargetChip({ onActivate, refocusInput });
  };

  return (
    <div
      data-section-chat-label
      className={targetPillSurfaceClass({
        interactive,
        active,
        pulsing,
        fullWidth,
        className,
      })}
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
      {showTargetPreview ? (
        <PreviewTargetThumbnail target={target} variant="pill" />
      ) : null}
      <span className="min-w-0 flex-1 break-words whitespace-normal font-medium">{breadcrumb}</span>
    </div>
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
  const label = formatPreviewTargetLabel(target);

  return (
    <div className={cn('mb-2 space-y-1', className)}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', TEXT.muted)}>
          Edit target
        </span>
        <ClearPinButton label={label} onClear={onClear} />
      </div>
      <TargetPillRow
        target={target}
        chipVariant="pinned"
        interactive={interactive}
        active={active}
        pulsing={pulsing}
        fullWidth
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
        onActivate={onActivate}
        refocusInput={refocusInput}
        className={cn(
          'target-pin-card min-w-0',
          interactive && !active && cn(BORDER.hairline, 'hover:border-[#d2d2d7]')
        )}
      />
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
  return (
    <TargetPillRow
      target={target}
      chipVariant="used"
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

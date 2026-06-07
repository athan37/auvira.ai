'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { BORDER, CONTROL, TEXT } from '@/content/productTheme';
import { PreviewTargetCardLayout } from '@/components/project/PreviewTargetCardLayout';
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
  inferPreviewScaleProfile,
  resolvePreviewThumbSourceDimensions,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';
import { leafContainerKind, resolveTargetChain } from '@/lib/preview/targetChain';

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

function TargetCardHeader({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('text-[10px] font-semibold uppercase tracking-wider', TEXT.muted)}>
        Edit target
      </span>
      <ClearPinButton label={label} onClear={onClear} />
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
    'target-pin-card w-full overflow-hidden transition-colors',
    options.interactive &&
      (options.active
        ? 'cursor-pointer ring-2 ring-rose-400/40 ring-offset-1'
        : cn('cursor-pointer hover:shadow', BORDER.hairline, 'hover:border-[#d2d2d7]')),
    options.pulsing && 'ring-2 ring-rose-400/50 ring-offset-1',
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
  const label = formatPreviewTargetLabel(target);
  const chipText = formatPreviewTargetChipText(target, 'pinned');
  const canActivate = interactive && Boolean(onActivate);
  const source = resolvePreviewThumbSourceDimensions(target);
  const previewLeafContainerKind = leafContainerKind(resolveTargetChain(target));
  const isSectionPreview =
    target.kind === 'hero' ||
    inferPreviewScaleProfile(
      source.width,
      source.height,
      target.pinScope,
      target.elementKind,
      target.kind,
      previewLeafContainerKind
    ) === 'section';

  const activate = () => {
    activatePreviewTargetChip({ onActivate, refocusInput });
  };

  const body = (
    <PreviewTargetCardLayout
      target={target}
      variant="pinned"
      showHint
      edgeToEdgePreview={isSectionPreview}
      className={isSectionPreview ? 'pt-0' : 'pt-2'}
    />
  );

  const bodyPaddingClass = cn('pb-3', isSectionPreview ? '' : 'px-3');

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
          className={cn('block w-full text-left', bodyPaddingClass)}
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
        <div className={bodyPaddingClass} aria-live="polite">
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
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-xl px-2 py-1 text-xs transition-colors',
        CONTROL.chip,
        TEXT.primary,
        interactive &&
          (active
            ? 'cursor-pointer ring-2 ring-rose-400/50 ring-offset-1'
            : 'cursor-pointer hover:bg-rose-50/60'),
        pulsing && 'ring-2 ring-rose-400/50 ring-offset-1',
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
      {showTargetPreview ? (
        <PreviewTargetThumbnail target={target} variant="pill" />
      ) : null}
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

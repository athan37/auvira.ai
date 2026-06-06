'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
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

function pinnedCardSurfaceClass(options: {
  interactive: boolean;
  active: boolean;
  pulsing: boolean;
  className?: string;
}): string {
  return cn(
    'w-full overflow-hidden rounded-xl border border-zinc-200/80 border-l-[3px] border-l-blue-500 bg-white shadow-sm transition-colors',
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
        'inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-200/80 bg-zinc-100 px-2 py-1 text-xs text-zinc-800 transition-colors',
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

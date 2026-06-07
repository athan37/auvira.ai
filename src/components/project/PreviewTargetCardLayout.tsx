'use client';

import { cn } from '@/lib/cn';
import { TEXT } from '@/content/productTheme';
import { Badge } from '@/components/ui/Badge';
import {
  formatPreviewTargetCompactBreadcrumb,
  formatPreviewTargetDisplay,
  formatPreviewTargetPrimaryLabel,
  shouldShowTargetBreadcrumb,
} from '@/lib/preview/previewTargetChipLabels';
import { PreviewTargetThumbnail } from '@/components/project/PreviewTargetThumbnail';
import {
  inferPreviewScaleProfile,
  resolvePreviewThumbSourceDimensions,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
  type PreviewThumbVariant,
} from '@/lib/preview/targetPreviewThumbnail';
import { leafContainerKind, resolveTargetChain } from '@/lib/preview/targetChain';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

interface Props {
  target: SelectedTargetInput;
  variant: PreviewThumbVariant;
  showHint?: boolean;
  progressive?: boolean;
  captureWidth?: number;
  captureHeight?: number;
  className?: string;
  align?: 'start' | 'center';
  /** Section preview spans card width; metadata keeps horizontal inset. */
  edgeToEdgePreview?: boolean;
}

/** Shared vertical preview-first body for pinned cards and drag ghosts. */
export function PreviewTargetCardLayout({
  target,
  variant,
  showHint = false,
  progressive = false,
  captureWidth,
  captureHeight,
  className,
  align = 'start',
  edgeToEdgePreview = false,
}: Props) {
  const display = formatPreviewTargetDisplay(target);
  const primaryLabel = formatPreviewTargetPrimaryLabel(target);
  const showBreadcrumb = shouldShowTargetBreadcrumb(target);
  const breadcrumb = showBreadcrumb ? formatPreviewTargetCompactBreadcrumb(target) : null;
  const showPreview = Boolean(
    targetPreviewDisplayUrl(target) || targetPreviewFallbackLabel(target)
  );
  const source = resolvePreviewThumbSourceDimensions(target, {
    width: captureWidth,
    height: captureHeight,
  });
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
  const edgeToEdge = edgeToEdgePreview || isSectionPreview;
  const isCentered = align === 'center';

  return (
    <div className={cn('space-y-2', edgeToEdge && progressive && 'relative', className)}>
      {showPreview ? (
        <PreviewTargetThumbnail
          target={target}
          variant={variant}
          fullWidth
          fullBleed={false}
          progressive={progressive}
          captureWidth={captureWidth}
          captureHeight={captureHeight}
        />
      ) : null}
      <div
        className={cn(
          'min-w-0 space-y-1',
          edgeToEdge && 'px-3',
          edgeToEdge && showPreview && 'pt-2',
          isCentered && 'text-center'
        )}
      >
        <div className={cn('flex flex-wrap items-center gap-2', isCentered && 'justify-center')}>
          <Badge tone="rose" className="shrink-0">
            {display.scopeLabel}
          </Badge>
        </div>
        <p className={cn('text-sm font-semibold break-words line-clamp-2', TEXT.primary)}>{primaryLabel}</p>
        {breadcrumb ? (
          <p className={cn('text-[11px] break-words line-clamp-1', TEXT.muted)}>{breadcrumb}</p>
        ) : null}
      </div>
      {showHint ? (
        <p className={cn('text-[11px] pt-0.5', TEXT.muted, edgeToEdge && 'px-3')}>
          Describe what to change in the box below
        </p>
      ) : null}
    </div>
  );
}

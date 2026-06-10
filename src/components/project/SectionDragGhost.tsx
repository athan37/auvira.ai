'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';
import { clampDragGhostPosition } from '@/lib/preview/clampDragGhostPosition';
import { formatPreviewTargetBreadcrumb } from '@/lib/preview/previewTargetChipLabels';
import {
  computeDragGhostDimensions,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
  type TargetPreviewCaptureKind,
} from '@/lib/preview/targetPreviewThumbnail';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { PreviewTargetPillThumb } from '@/components/project/PreviewTargetPillThumb';
import { BORDER, CONTROL, TEXT } from '@/content/productTheme';

interface Props {
  payload: SelectedSectionPayload;
  x: number;
  y: number;
  previewDataUrl?: string;
  previewCaptureKind?: TargetPreviewCaptureKind;
  previewWidth?: number;
  previewHeight?: number;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

type DragGhostLayout = ReturnType<typeof computeDragGhostDimensions>;

/** Floating ghost while dragging a preview section or element toward chat. */
export function SectionDragGhost({
  payload,
  x,
  y,
  previewDataUrl,
  previewCaptureKind,
  previewWidth,
  previewHeight,
  grabOffsetX = 12,
  grabOffsetY = 12,
}: Props) {
  const layoutRef = useRef<DragGhostLayout | null>(null);

  const kind = payload.sectionType === 'hero' || payload.sectionIndex < 0 ? 'hero' : 'section';
  const target = normalizeSelectedTarget({
    kind,
    sectionId: payload.sectionId,
    analyticsId: payload.analyticsId ?? payload.sectionId,
    sectionIndex: kind === 'section' ? payload.sectionIndex : undefined,
    sectionType: payload.sectionType,
    sectionTitle: payload.sectionTitle,
    fieldPath: payload.fieldPath,
    itemIndex: payload.itemIndex,
    elementKind: payload.elementKind,
    elementLabel: payload.elementLabel,
    surfaceId: payload.surfaceId,
    targetChain: payload.targetChain,
    pinScope: payload.pinScope,
    previewThumbnail: previewDataUrl
      ? {
          previewUrl: previewDataUrl,
          width: previewWidth,
          height: previewHeight,
          captureKind: previewCaptureKind,
        }
      : undefined,
    previewThumbnailDataUrl: previewDataUrl,
    previewCaptureWidth: previewWidth,
    previewCaptureHeight: previewHeight,
  });
  if (!target) return null;

  const breadcrumb = formatPreviewTargetBreadcrumb(target);
  const hasThumbnailContent = Boolean(
    previewDataUrl || targetPreviewDisplayUrl(target) || targetPreviewFallbackLabel(target)
  );

  if (!layoutRef.current) {
    layoutRef.current = computeDragGhostDimensions(target, {
      captureWidth: previewWidth,
      captureHeight: previewHeight,
      showPreview: true,
      showBreadcrumb: Boolean(breadcrumb),
      stablePillThumb: true,
    });
  }

  const { ghostWidth, ghostHeight } = layoutRef.current;

  const position = clampDragGhostPosition({
    pointerX: x,
    pointerY: y,
    grabOffsetX,
    grabOffsetY,
    ghostWidth,
    ghostHeight,
  });

  return (
    <div
      className={cn(
        'fixed z-[100] pointer-events-none inline-flex max-w-full items-center gap-2 rounded-xl border border-l-[3px] border-l-rose-500 px-2 py-1 shadow-xl',
        BORDER.hairline,
        CONTROL.chip,
        'bg-white'
      )}
      style={{
        left: position.left,
        top: position.top,
        width: ghostWidth,
        height: ghostHeight,
        transform: 'translate3d(0,0,0)',
      }}
      aria-hidden
    >
      <PreviewTargetPillThumb
        target={target}
        captureWidth={previewWidth}
        captureHeight={previewHeight}
        showPlaceholder={!hasThumbnailContent}
      />
      {breadcrumb ? (
        <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', TEXT.primary)}>
          {breadcrumb}
        </span>
      ) : null}
    </div>
  );
}

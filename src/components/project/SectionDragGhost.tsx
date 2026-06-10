'use client';

import { cn } from '@/lib/cn';
import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';
import { clampDragGhostPosition } from '@/lib/preview/clampDragGhostPosition';
import { formatPreviewTargetBreadcrumb } from '@/lib/preview/previewTargetChipLabels';
import {
  computeDragGhostDimensions,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { PreviewTargetThumbnail } from '@/components/project/PreviewTargetThumbnail';
import { BORDER, CONTROL, TEXT } from '@/content/productTheme';

interface Props {
  payload: SelectedSectionPayload;
  x: number;
  y: number;
  previewDataUrl?: string;
  previewWidth?: number;
  previewHeight?: number;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

/** Floating ghost while dragging a preview section or element toward chat. */
export function SectionDragGhost({
  payload,
  x,
  y,
  previewDataUrl,
  previewWidth,
  previewHeight,
  grabOffsetX = 12,
  grabOffsetY = 12,
}: Props) {
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
    previewThumbnailDataUrl: previewDataUrl,
    previewCaptureWidth: previewWidth,
    previewCaptureHeight: previewHeight,
  });
  if (!target) return null;

  const showPreview = Boolean(
    previewDataUrl || targetPreviewDisplayUrl(target) || targetPreviewFallbackLabel(target)
  );
  const breadcrumb = formatPreviewTargetBreadcrumb(target);
  const { ghostWidth, ghostHeight } = computeDragGhostDimensions(target, {
    captureWidth: previewWidth,
    captureHeight: previewHeight,
    showPreview,
    showBreadcrumb: Boolean(breadcrumb),
  });

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
        'fixed z-[100] pointer-events-none inline-flex max-w-full items-center gap-2 rounded-xl border border-l-[3px] border-l-rose-500 px-2 py-1 shadow-xl transition-transform duration-150 ease-out',
        BORDER.hairline,
        CONTROL.chip,
        'bg-white'
      )}
      style={{
        left: position.left,
        top: position.top,
        maxWidth: ghostWidth,
        transform: 'translate3d(0,0,0)',
      }}
      aria-hidden
    >
      {showPreview ? (
        <PreviewTargetThumbnail
          target={target}
          variant="pill"
          progressive
          captureWidth={previewWidth}
          captureHeight={previewHeight}
        />
      ) : null}
      <span className={cn('min-w-0 break-words whitespace-normal text-xs font-medium', TEXT.primary)}>
        {breadcrumb}
      </span>
    </div>
  );
}

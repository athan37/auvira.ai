'use client';

import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';
import { clampDragGhostPosition } from '@/lib/preview/clampDragGhostPosition';
import { PreviewTargetCardLayout } from '@/components/project/PreviewTargetCardLayout';
import {
  computeDragGhostDimensions,
  DRAG_GHOST_CARD_WIDTH,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';
import { shouldShowTargetBreadcrumb } from '@/lib/preview/previewTargetChipLabels';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

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
  const showBreadcrumb = shouldShowTargetBreadcrumb(target);
  const { ghostHeight } = computeDragGhostDimensions(target, {
    captureWidth: previewWidth,
    captureHeight: previewHeight,
    showPreview,
    showBreadcrumb,
  });

  const position = clampDragGhostPosition({
    pointerX: x,
    pointerY: y,
    grabOffsetX,
    grabOffsetY,
    ghostWidth: DRAG_GHOST_CARD_WIDTH,
    ghostHeight,
  });

  return (
    <div
      className="fixed z-[100] pointer-events-none overflow-hidden rounded-xl border border-zinc-200/80 border-l-[3px] border-l-brand-500 bg-white py-2 shadow-xl transition-transform duration-150 ease-out"
      style={{
        left: position.left,
        top: position.top,
        width: DRAG_GHOST_CARD_WIDTH,
        transform: 'translate3d(0,0,0)',
      }}
      aria-hidden
    >
      <div className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Edit target
      </div>
      <PreviewTargetCardLayout
        target={target}
        variant="drag"
        progressive
        align="center"
        edgeToEdgePreview
        captureWidth={previewWidth}
        captureHeight={previewHeight}
      />
    </div>
  );
}

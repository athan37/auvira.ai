'use client';

import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';
import { clampDragGhostPosition } from '@/lib/preview/clampDragGhostPosition';
import { formatPreviewTargetDisplay } from '@/lib/preview/previewTargetChipLabels';
import { PreviewTargetThumbnail } from '@/components/project/PreviewTargetThumbnail';
import {
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { Badge } from '@/components/ui/Badge';

interface Props {
  payload: SelectedSectionPayload;
  x: number;
  y: number;
  previewDataUrl?: string;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

const MAX_CHAIN_ROWS = 2;

/** Floating ghost while dragging a preview section or element toward chat. */
export function SectionDragGhost({
  payload,
  x,
  y,
  previewDataUrl,
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
  });
  if (!target) return null;

  const display = formatPreviewTargetDisplay(target);
  const showTitle = display.title.toLowerCase() !== display.scopeLabel.toLowerCase();
  const showTargetPreview = Boolean(
    previewDataUrl || targetPreviewDisplayUrl(target) || targetPreviewFallbackLabel(target)
  );

  const chainRows = display.chainRows?.slice(-MAX_CHAIN_ROWS);
  const primaryLabel =
    chainRows?.[chainRows.length - 1]?.label ??
    display.element?.label ??
    (showTitle ? display.title : display.scopeLabel);

  const position = clampDragGhostPosition({
    pointerX: x,
    pointerY: y,
    grabOffsetX,
    grabOffsetY,
    ghostWidth: 200,
    ghostHeight: showTargetPreview ? 180 : 80,
  });

  return (
    <div
      className="fixed z-[100] pointer-events-none w-[200px] rounded-lg border border-zinc-200/80 border-l-[3px] border-l-blue-500 bg-white px-2.5 py-2 shadow-xl transition-transform duration-150 ease-out scale-100"
      style={{
        left: position.left,
        top: position.top,
        transform: 'translate3d(0,0,0)',
      }}
      aria-hidden
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Edit target
      </div>
      {showTargetPreview ? (
        <div className="flex justify-center mb-2">
          <PreviewTargetThumbnail target={target} size="md" progressive />
        </div>
      ) : null}
      <div className="min-w-0 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Badge tone="info" className="shrink-0 text-[10px]">
            {display.scopeLabel}
          </Badge>
        </div>
        {primaryLabel ? (
          <p className="mt-1 text-xs font-semibold text-zinc-950 break-words line-clamp-2">
            {primaryLabel}
          </p>
        ) : null}
        {chainRows && chainRows.length > 1 ? (
          <div className="mt-1 space-y-0.5">
            {chainRows.slice(0, -1).map((row, index) => (
              <p
                key={`${row.role}-${row.label}-${index}`}
                className="text-[10px] text-zinc-500 break-words line-clamp-1"
              >
                {row.label}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

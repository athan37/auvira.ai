'use client';

import type { SelectedSectionPayload } from '@/lib/preview/sectionSelectionProtocol';
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
}

/** Floating ghost while dragging a preview section or element toward chat. */
export function SectionDragGhost({ payload, x, y, previewDataUrl }: Props) {
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

  return (
    <div
      className="fixed z-[100] pointer-events-none max-w-[360px] rounded-lg border border-zinc-200/80 border-l-[3px] border-l-blue-500 bg-white px-3 py-2 shadow-xl"
      style={{ left: x + 12, top: y + 12 }}
      aria-hidden
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Edit target
      </div>
      <div className={showTargetPreview ? 'flex gap-2.5' : ''}>
        {showTargetPreview && <PreviewTargetThumbnail target={target} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="info" className="shrink-0 text-[10px]">
              {display.scopeLabel}
            </Badge>
            {showTitle ? (
              <span className="text-sm font-semibold text-zinc-950 break-words">{display.title}</span>
            ) : null}
          </div>
          {display.chainRows && display.chainRows.length > 0 ? (
            <div className="mt-1.5 space-y-0.5">
              {display.chainRows.map((row, index) => (
                <div
                  key={`${row.role}-${row.label}-${index}`}
                  className="text-sm text-zinc-700 break-words"
                  style={{ paddingLeft: `${row.depth * 12}px` }}
                >
                  <span className="text-zinc-300 mr-1" aria-hidden>
                    ⌞
                  </span>
                  {row.label}
                </div>
              ))}
            </div>
          ) : display.element ? (
            <div className="mt-1.5 pl-3 text-sm text-zinc-700 break-words">
              <span className="text-zinc-300 mr-1" aria-hidden>
                ⌞
              </span>
              {display.element.label}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

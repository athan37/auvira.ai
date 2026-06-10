'use client';

import { cn } from '@/lib/cn';
import { PreviewTargetThumbnail } from '@/components/project/PreviewTargetThumbnail';
import {
  DRAG_GHOST_PILL_THUMB_BOX,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
} from '@/lib/preview/targetPreviewThumbnail';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

/** Fixed 88×56 pill thumbnail slot — shared by drag ghost and chat target chips. */
export function PreviewTargetPillThumb({
  target,
  captureWidth,
  captureHeight,
  showPlaceholder = false,
  className,
}: {
  target: Pick<
    SelectedTargetInput,
    | 'previewThumbnail'
    | 'previewThumbnailDataUrl'
    | 'previewCaptureWidth'
    | 'previewCaptureHeight'
    | 'elementLabel'
    | 'targetChain'
    | 'sectionTitle'
    | 'pinScope'
    | 'kind'
    | 'elementKind'
  >;
  captureWidth?: number;
  captureHeight?: number;
  showPlaceholder?: boolean;
  className?: string;
}) {
  const resolvedWidth = captureWidth ?? target.previewCaptureWidth;
  const resolvedHeight = captureHeight ?? target.previewCaptureHeight;
  const hasContent =
    showPlaceholder ||
    Boolean(targetPreviewDisplayUrl(target) || targetPreviewFallbackLabel(target));

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f5f5f7]/80',
        className
      )}
      style={{
        width: DRAG_GHOST_PILL_THUMB_BOX.width,
        height: DRAG_GHOST_PILL_THUMB_BOX.height,
      }}
    >
      {hasContent ? (
        <PreviewTargetThumbnail
          target={target}
          variant="pill"
          progressive={false}
          captureWidth={resolvedWidth}
          captureHeight={resolvedHeight}
          className="!mx-0 max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-[#d2d2d7]/70" aria-hidden />
      )}
    </div>
  );
}

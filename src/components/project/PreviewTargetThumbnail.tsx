'use client';

import { cn } from '@/lib/cn';
import {
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
  TARGET_PREVIEW_THUMB_HEIGHT,
  TARGET_PREVIEW_THUMB_WIDTH,
} from '@/lib/preview/targetPreviewThumbnail';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

interface Props {
  target: Pick<
    SelectedTargetInput,
    | 'previewThumbnail'
    | 'previewThumbnailDataUrl'
    | 'elementLabel'
    | 'targetChain'
    | 'sectionTitle'
    | 'pinScope'
  >;
  className?: string;
  size?: 'sm' | 'md';
}

/** Mini screenshot (or styled text replica) of the pinned preview drag target. */
export function PreviewTargetThumbnail({ target, className, size = 'md' }: Props) {
  const src = targetPreviewDisplayUrl(target);
  const fallbackLabel = targetPreviewFallbackLabel(target);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={TARGET_PREVIEW_THUMB_WIDTH}
        height={TARGET_PREVIEW_THUMB_HEIGHT}
        className={cn(
          'shrink-0 rounded-md border border-zinc-200/80 bg-zinc-50 object-contain object-center shadow-sm',
          size === 'sm' ? 'h-14 w-20' : 'h-20 w-28',
          className
        )}
      />
    );
  }

  if (!fallbackLabel) return null;

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-md border border-zinc-200/80 bg-white p-2 shadow-sm',
        size === 'sm' ? 'h-14 w-20' : 'h-20 w-28',
        className
      )}
      aria-hidden
    >
      <p className="line-clamp-4 text-[10px] font-semibold leading-snug text-zinc-900">{fallbackLabel}</p>
    </div>
  );
}

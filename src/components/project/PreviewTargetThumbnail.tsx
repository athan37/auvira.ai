'use client';

import { useEffect, useState } from 'react';
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
    | 'kind'
  >;
  className?: string;
  size?: 'sm' | 'md';
  /** Show shimmer skeleton until image loads or fallback timeout. */
  progressive?: boolean;
}

const SIZE_CLASS = {
  sm: 'h-14 w-20',
  md: 'h-20 w-28',
} as const;

/** Mini screenshot (or styled text replica) of the pinned preview drag target. */
export function PreviewTargetThumbnail({
  target,
  className,
  size = 'md',
  progressive = false,
}: Props) {
  const src = targetPreviewDisplayUrl(target);
  const fallbackLabel = targetPreviewFallbackLabel(target);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
    setShowFallback(false);
    if (!progressive || !src) return;
    const timer = window.setTimeout(() => setShowFallback(true), 300);
    return () => window.clearTimeout(timer);
  }, [src, progressive]);

  const sizeClass = SIZE_CLASS[size];

  if (src) {
    return (
      <div className={cn('relative shrink-0', sizeClass, className)} aria-hidden>
        {progressive && !imageLoaded ? (
          <div
            className={cn(
              'absolute inset-0 rounded-md border border-zinc-200/80 bg-zinc-100',
              'animate-pulse'
            )}
          />
        ) : null}
        <img
          src={src}
          alt=""
          width={TARGET_PREVIEW_THUMB_WIDTH}
          height={TARGET_PREVIEW_THUMB_HEIGHT}
          onLoad={() => setImageLoaded(true)}
          className={cn(
            'h-full w-full rounded-md border border-zinc-200/80 bg-zinc-50 object-contain object-center shadow-sm transition-opacity duration-150',
            progressive && !imageLoaded ? 'opacity-0' : 'opacity-100'
          )}
        />
      </div>
    );
  }

  if (!fallbackLabel) return null;

  if (progressive && !showFallback) {
    return (
      <div
        className={cn(
          'shrink-0 animate-pulse rounded-md border border-zinc-200/80 bg-zinc-100',
          sizeClass,
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-md border border-zinc-200/80 bg-white p-2 shadow-sm',
        sizeClass,
        className
      )}
      aria-hidden
    >
      <p className="line-clamp-4 text-[10px] font-semibold leading-snug text-zinc-900">
        {fallbackLabel}
      </p>
    </div>
  );
}

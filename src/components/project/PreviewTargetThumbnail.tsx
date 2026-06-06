'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  SECTION_PREVIEW_THUMB_MAX,
  resolvePreviewThumbDisplaySize,
  resolvePreviewThumbSourceDimensions,
  targetPreviewDisplayUrl,
  targetPreviewFallbackLabel,
  type PreviewThumbVariant,
} from '@/lib/preview/targetPreviewThumbnail';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

interface Props {
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
  /** Extend section preview to card edges (cancels horizontal padding). */
  fullBleed?: boolean;
  className?: string;
  /** @deprecated Use variant instead */
  size?: 'sm' | 'md';
  variant?: PreviewThumbVariant;
  /** Stretch to container width (pinned/drag cards). */
  fullWidth?: boolean;
  captureWidth?: number;
  captureHeight?: number;
  /** Show shimmer skeleton until image loads or fallback timeout. */
  progressive?: boolean;
}

function resolveVariant(size: 'sm' | 'md' | undefined, variant: PreviewThumbVariant | undefined): PreviewThumbVariant {
  if (variant) return variant;
  return size === 'sm' ? 'pill' : 'pinned';
}

/** Mini screenshot (or styled text replica) of the pinned preview drag target. */
export function PreviewTargetThumbnail({
  target,
  className,
  size,
  variant,
  fullWidth = false,
  captureWidth,
  captureHeight,
  progressive = false,
  fullBleed = false,
}: Props) {
  const resolvedVariant = resolveVariant(size, variant);
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

  const source = resolvePreviewThumbSourceDimensions(target, {
    width: captureWidth ?? target.previewCaptureWidth,
    height: captureHeight ?? target.previewCaptureHeight,
  });
  const display = resolvePreviewThumbDisplaySize(resolvedVariant, source.width, source.height, {
    fullWidth,
    elementKind: target.elementKind,
    pinScope: target.pinScope,
    kind: target.kind,
  });
  const sectionPreview = Boolean(display.fillWidth);

  if (src && sectionPreview) {
    const height = display.maxHeight ?? SECTION_PREVIEW_THUMB_MAX[resolvedVariant].height;
    const widthClass = fullBleed ? 'w-full' : 'w-full max-w-full';

    return (
      <>
        {progressive && !imageLoaded ? (
          <div
            className={cn('animate-pulse rounded-xl bg-zinc-200/80', widthClass)}
            style={{ height }}
            aria-hidden
          />
        ) : null}
        <img
          src={src}
          alt=""
          onLoad={() => setImageLoaded(true)}
          className={cn(
            'block rounded-xl object-cover',
            widthClass,
            progressive && !imageLoaded ? 'absolute opacity-0' : 'opacity-100',
            className
          )}
          style={{ height }}
          aria-hidden
        />
      </>
    );
  }

  if (src) {
    const bleedClass = fullBleed
      ? resolvedVariant === 'drag'
        ? '-mx-2.5 w-[calc(100%+1.25rem)] max-w-none'
        : '-mx-3 w-[calc(100%+1.5rem)] max-w-none'
      : 'mx-auto max-w-full';

    return (
      <>
        {progressive && !imageLoaded ? (
          <div
            className={cn('animate-pulse rounded-xl bg-zinc-200/80 mx-auto', bleedClass)}
            style={{
              width: display.width,
              height: display.height,
              aspectRatio: display.aspectRatio,
            }}
            aria-hidden
          />
        ) : null}
        <img
          src={src}
          alt=""
          onLoad={() => setImageLoaded(true)}
          className={cn(
            'block rounded-md object-contain transition-opacity duration-150',
            bleedClass,
            progressive && !imageLoaded ? 'absolute opacity-0' : 'opacity-100',
            className
          )}
          style={{
            width: display.width,
            height: display.height,
            aspectRatio: display.aspectRatio,
          }}
          aria-hidden
        />
      </>
    );
  }

  if (!fallbackLabel) return null;

  const fallbackFrameClass = cn(
    'relative shrink-0 overflow-hidden rounded-md border border-zinc-200/80 bg-white p-2 shadow-sm',
    fullWidth && 'w-full',
    className
  );
  const fallbackStyle = {
    width: fullWidth ? '100%' : display.width,
    maxWidth: display.width,
    height: display.height,
    aspectRatio: display.aspectRatio,
  };

  if (progressive && !showFallback) {
    return (
      <div
        className={cn(fallbackFrameClass, 'animate-pulse bg-zinc-200/80')}
        style={fallbackStyle}
        aria-hidden
      />
    );
  }

  return (
    <div className={fallbackFrameClass} style={fallbackStyle} aria-hidden>
      <p className="line-clamp-4 text-[10px] font-semibold leading-snug text-zinc-900">
        {fallbackLabel}
      </p>
    </div>
  );
}

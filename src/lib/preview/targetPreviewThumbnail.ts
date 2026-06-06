import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { resolveTargetChain } from '@/lib/preview/targetChain';

const GENERIC_TARGET_LABELS = new Set([
  'Item cards',
  'Item title',
  'Item description',
  'Section title',
  'Section intro',
]);

/** Canvas render box for bridge captures (display uses aspect-ratio helpers below). */
export const TARGET_PREVIEW_THUMB_WIDTH = 112;
export const TARGET_PREVIEW_THUMB_HEIGHT = 80;

export type PreviewThumbVariant = 'pinned' | 'drag' | 'pill';

/** Max display bounds per surface (CSS pixels). */
export const PREVIEW_THUMB_MAX = {
  pinned: { width: 168, height: 112 },
  drag: { width: 152, height: 104 },
  pill: { width: 88, height: 56 },
} as const;

/** Larger display bounds for full-section composite previews. */
export const SECTION_PREVIEW_THUMB_MAX = {
  pinned: { width: 400, height: 200 },
  drag: { width: 260, height: 156 },
  pill: { width: 88, height: 56 },
} as const;

export const DRAG_GHOST_CARD_WIDTH = 260;
export const DRAG_GHOST_CARD_PADDING_X = 20;
export const DRAG_GHOST_META_BLOCK_HEIGHT = 56;
export const DRAG_GHOST_HEADER_HEIGHT = 22;
export const TARGET_PREVIEW_THUMB_PADDING = 8;
/** Device pixel ratio for sharper canvas captures (display size unchanged). */
export const TARGET_PREVIEW_THUMB_DPR = 2;
export const TARGET_PREVIEW_THUMB_RENDER_WIDTH = TARGET_PREVIEW_THUMB_WIDTH * TARGET_PREVIEW_THUMB_DPR;
export const TARGET_PREVIEW_THUMB_RENDER_HEIGHT =
  TARGET_PREVIEW_THUMB_HEIGHT * TARGET_PREVIEW_THUMB_DPR;

export type TargetPreviewCaptureKind = 'raster' | 'styled_fallback';

export type PreviewScaleProfile = 'section' | 'element';

/** Minimum capture dimensions treated as a full-section composite preview. */
export const SECTION_COMPOSITE_CAPTURE_MIN = { width: 240, height: 100 } as const;

/** Target display height for bare styled previews (preserves aspect ratio). */
export const BARE_PREVIEW_TARGET_HEIGHT: Partial<Record<string, number>> = {
  contact_field: 40,
  button: 48,
  heading: 48,
  item_title: 48,
  body: 56,
  item_body: 56,
  item_card: 76,
  section: 180,
};

/** @deprecated Use BARE_PREVIEW_TARGET_HEIGHT */
export const COMPACT_PREVIEW_TARGET_HEIGHT = BARE_PREVIEW_TARGET_HEIGHT;

/** Scale source dimensions down to fit inside a thumbnail box. */
export function fitScaleToBox(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
  options?: { maxScale?: number }
): { width: number; height: number; scale: number } {
  const safeW = Math.max(sourceWidth, 1);
  const safeH = Math.max(sourceHeight, 1);
  const maxScale = options?.maxScale ?? 1;
  const scale = Math.min(boxWidth / safeW, boxHeight / safeH, maxScale);
  return {
    scale,
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

/** Infer whether a capture should display at section scale vs compact element scale. */
export function inferPreviewScaleProfile(
  sourceWidth: number,
  sourceHeight: number,
  pinScope?: string,
  elementKind?: string,
  kind?: string
): PreviewScaleProfile {
  if (pinScope === 'element') {
    if (elementKind && BARE_PREVIEW_TARGET_HEIGHT[elementKind]) {
      return 'element';
    }
    if (
      sourceWidth >= SECTION_COMPOSITE_CAPTURE_MIN.width &&
      sourceHeight >= SECTION_COMPOSITE_CAPTURE_MIN.height
    ) {
      return 'section';
    }
    return 'element';
  }
  if (kind === 'hero') return 'section';
  if (pinScope && pinScope !== 'element') return 'section';
  if (
    sourceWidth >= SECTION_COMPOSITE_CAPTURE_MIN.width &&
    sourceHeight >= SECTION_COMPOSITE_CAPTURE_MIN.height
  ) {
    return 'section';
  }
  return 'element';
}

/** Resolve target display height for height-scaled bare previews. */
export function resolveBarePreviewDisplayHeight(options?: {
  elementKind?: string;
  pinScope?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}): number | undefined {
  const profile = inferPreviewScaleProfile(
    options?.sourceWidth ?? 0,
    options?.sourceHeight ?? 0,
    options?.pinScope,
    options?.elementKind
  );
  if (profile === 'section') {
    return BARE_PREVIEW_TARGET_HEIGHT.section;
  }
  if (options?.elementKind && BARE_PREVIEW_TARGET_HEIGHT[options.elementKind]) {
    return BARE_PREVIEW_TARGET_HEIGHT[options.elementKind];
  }
  return undefined;
}

/** True when the target should render as a bare preview (no gray frame). */
export function isBarePreviewTarget(
  elementKind: string | undefined,
  pinScope?: string
): boolean {
  return Boolean(resolveBarePreviewDisplayHeight({ elementKind, pinScope }));
}

/** @deprecated Use isBarePreviewTarget */
export function isCompactPreviewTarget(
  elementKind: string | undefined,
  _sourceWidth: number,
  _sourceHeight: number
): boolean {
  return elementKind === 'contact_field' || elementKind === 'button';
}

/** True when a bare preview may upscale for readability. */
export function shouldUpscaleBarePreview(
  elementKind: string | undefined,
  pinScope?: string
): boolean {
  return isBarePreviewTarget(elementKind, pinScope);
}

/** @deprecated Use shouldUpscaleBarePreview */
export function shouldUpscaleCompactPreview(
  elementKind: string | undefined,
  sourceWidth: number,
  sourceHeight: number
): boolean {
  return isCompactPreviewTarget(elementKind, sourceWidth, sourceHeight);
}

export interface TargetPreviewThumbnail {
  previewUrl: string;
  publicUrl?: string;
  path?: string;
  width?: number;
  height?: number;
  captureKind?: TargetPreviewCaptureKind;
}

export interface TargetPreviewThumbMessage {
  sectionId: string;
  surfaceId?: string;
  fieldPath?: string;
  dataUrl: string;
  captureKind: TargetPreviewCaptureKind;
  width: number;
  height: number;
}

type PreviewThumbDimensionTarget = Pick<
  SelectedTargetInput,
  'previewThumbnail' | 'elementKind' | 'pinScope' | 'kind'
> & {
  previewCaptureWidth?: number;
  previewCaptureHeight?: number;
};

function fallbackSourceDimensions(target: PreviewThumbDimensionTarget): {
  width: number;
  height: number;
} {
  if (target.pinScope === 'element') {
    switch (target.elementKind) {
      case 'button':
        return { width: 120, height: 40 };
      case 'heading':
      case 'item_title':
        return { width: 320, height: 48 };
      case 'body':
      case 'item_body':
        return { width: 280, height: 72 };
      case 'contact_field':
        return { width: 200, height: 36 };
      case 'item_card':
        return { width: 160, height: 120 };
      default:
        return { width: 160, height: 64 };
    }
  }
  if (target.kind === 'hero') {
    return { width: 400, height: 240 };
  }
  return { width: 280, height: 158 };
}

/** Resolve intrinsic capture dimensions (element rect) for aspect-ratio layout. */
export function resolvePreviewThumbSourceDimensions(
  target: PreviewThumbDimensionTarget,
  overrides?: { width?: number; height?: number }
): { width: number; height: number } {
  if (
    overrides?.width &&
    overrides.height &&
    Number.isFinite(overrides.width) &&
    Number.isFinite(overrides.height)
  ) {
    return {
      width: Math.max(1, Math.round(overrides.width)),
      height: Math.max(1, Math.round(overrides.height)),
    };
  }
  if (
    target.previewCaptureWidth &&
    target.previewCaptureHeight &&
    Number.isFinite(target.previewCaptureWidth) &&
    Number.isFinite(target.previewCaptureHeight)
  ) {
    return {
      width: Math.max(1, Math.round(target.previewCaptureWidth)),
      height: Math.max(1, Math.round(target.previewCaptureHeight)),
    };
  }
  const thumb = target.previewThumbnail;
  if (thumb?.width && thumb.height) {
    return {
      width: Math.max(1, Math.round(thumb.width)),
      height: Math.max(1, Math.round(thumb.height)),
    };
  }
  return fallbackSourceDimensions(target);
}

/** Scale source dimensions to fit a variant max box while preserving aspect ratio. */
export function resolvePreviewThumbDisplaySize(
  variant: PreviewThumbVariant,
  sourceWidth: number,
  sourceHeight: number,
  options?: {
    fullWidth?: boolean;
    containerWidth?: number;
    elementKind?: string;
    pinScope?: string;
    kind?: string;
    captureKind?: TargetPreviewCaptureKind;
  }
): {
  width: number;
  height: number;
  aspectRatio: string;
  fillWidth?: boolean;
  maxHeight?: number;
  objectFit?: 'contain' | 'cover';
} {
  const max = PREVIEW_THUMB_MAX[variant];
  const aspectRatio = `${Math.max(1, Math.round(sourceWidth))} / ${Math.max(1, Math.round(sourceHeight))}`;
  const profile = inferPreviewScaleProfile(
    sourceWidth,
    sourceHeight,
    options?.pinScope,
    options?.elementKind,
    options?.kind
  );

  if (profile === 'section') {
    const sectionMax = SECTION_PREVIEW_THUMB_MAX[variant];
    const boxWidth =
      options?.fullWidth && options.containerWidth
        ? Math.max(sectionMax.width, Math.round(options.containerWidth))
        : sectionMax.width;
    const fit = fitScaleToBox(sourceWidth, sourceHeight, boxWidth, sectionMax.height);
    const raster = options?.captureKind === 'raster';
    return {
      width: fit.width,
      height: fit.height,
      maxHeight: sectionMax.height,
      aspectRatio,
      fillWidth: Boolean(options?.fullWidth),
      objectFit: raster ? 'contain' : 'cover',
    };
  }

  const bareHeight = resolveBarePreviewDisplayHeight({
    elementKind: options?.elementKind,
    pinScope: options?.pinScope,
    sourceWidth,
    sourceHeight,
  });
  if (bareHeight) {
    const maxScale = 4;
    const scale = Math.min(bareHeight / Math.max(sourceHeight, 1), maxScale);
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
      aspectRatio,
    };
  }

  const boxWidth =
    options?.fullWidth && options.containerWidth
      ? Math.min(max.width, Math.max(1, Math.round(options.containerWidth)))
      : max.width;
  const fit = fitScaleToBox(sourceWidth, sourceHeight, boxWidth, max.height);
  return {
    width: fit.width,
    height: fit.height,
    aspectRatio,
  };
}

/** Estimate drag ghost card height from thumb + label block. */
export function computeDragGhostDimensions(
  target: PreviewThumbDimensionTarget,
  options?: {
    captureWidth?: number;
    captureHeight?: number;
    showPreview?: boolean;
    showBreadcrumb?: boolean;
  }
): { ghostWidth: number; ghostHeight: number; thumbHeight: number } {
  const innerWidth = DRAG_GHOST_CARD_WIDTH - DRAG_GHOST_CARD_PADDING_X;
  const source = resolvePreviewThumbSourceDimensions(target, {
    width: options?.captureWidth,
    height: options?.captureHeight,
  });
  const thumb = resolvePreviewThumbDisplaySize('drag', source.width, source.height, {
    fullWidth: true,
    containerWidth: innerWidth,
    elementKind: target.elementKind,
    pinScope: target.pinScope,
    kind: target.kind,
  });
  const showPreview = options?.showPreview !== false;
  const previewBlock = showPreview ? thumb.height + 8 : 0;
  const breadcrumbExtra = options?.showBreadcrumb ? 16 : 0;
  const ghostHeight =
    DRAG_GHOST_HEADER_HEIGHT + previewBlock + DRAG_GHOST_META_BLOCK_HEIGHT + breadcrumbExtra;
  return {
    ghostWidth: DRAG_GHOST_CARD_WIDTH,
    ghostHeight,
    thumbHeight: thumb.height,
  };
}

/** Resolve the best URL to display a target preview thumbnail. */
export function targetPreviewDisplayUrl(target: {
  previewThumbnail?: TargetPreviewThumbnail;
  previewThumbnailDataUrl?: string;
}): string | undefined {
  return target.previewThumbnail?.previewUrl ?? target.previewThumbnailDataUrl;
}

/** Text to render in a styled mini-card when raster capture is unavailable. */
export function targetPreviewFallbackLabel(
  target: Pick<
    SelectedTargetInput,
    'elementLabel' | 'targetChain' | 'sectionTitle' | 'pinScope' | 'kind'
  >
): string | undefined {
  const chain = resolveTargetChain(target as SelectedTargetInput);
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    if (node.role !== 'element' && node.role !== 'item') continue;
    const label = node.label?.trim();
    if (label && !GENERIC_TARGET_LABELS.has(label)) return label;
  }
  const elementLabel = target.elementLabel?.trim();
  if (elementLabel && !GENERIC_TARGET_LABELS.has(elementLabel)) return elementLabel;
  if (target.pinScope !== 'element' && target.sectionTitle?.trim()) {
    return target.sectionTitle.trim();
  }
  return undefined;
}

/** Convert a data URL to a File suitable for upload-assets. */
export function dataUrlToPreviewFile(dataUrl: string, filename = 'target-preview.jpg'): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
}

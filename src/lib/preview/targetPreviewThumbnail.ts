import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { resolveTargetChain } from '@/lib/preview/targetChain';

const GENERIC_TARGET_LABELS = new Set([
  'Item cards',
  'Item title',
  'Item description',
  'Section title',
  'Section intro',
]);

/** Fixed drag-preview thumbnail size (matches Edit target chip `w-28 h-20`). */
export const TARGET_PREVIEW_THUMB_WIDTH = 112;
export const TARGET_PREVIEW_THUMB_HEIGHT = 80;
export const TARGET_PREVIEW_THUMB_PADDING = 8;
/** Device pixel ratio for sharper canvas captures (display size unchanged). */
export const TARGET_PREVIEW_THUMB_DPR = 2;
export const TARGET_PREVIEW_THUMB_RENDER_WIDTH = TARGET_PREVIEW_THUMB_WIDTH * TARGET_PREVIEW_THUMB_DPR;
export const TARGET_PREVIEW_THUMB_RENDER_HEIGHT =
  TARGET_PREVIEW_THUMB_HEIGHT * TARGET_PREVIEW_THUMB_DPR;

export type TargetPreviewCaptureKind = 'raster' | 'styled_fallback';

/** Scale source dimensions down to fit inside a thumbnail box (never upscale). */
export function fitScaleToBox(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number
): { width: number; height: number; scale: number } {
  const safeW = Math.max(sourceWidth, 1);
  const safeH = Math.max(sourceHeight, 1);
  const scale = Math.min(boxWidth / safeW, boxHeight / safeH, 1);
  return {
    scale,
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
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

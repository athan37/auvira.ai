/**
 * Shared types for UI-pinned section target (preview selection → edit agent).
 */

import {
  allowedFieldPathsForTarget,
  enrichSelectedTarget,
  resolvePinScope,
  type PinScope,
  type TargetChainNode,
} from '@/lib/preview/targetChain';
import type {
  TargetPreviewCaptureKind,
  TargetPreviewThumbnail,
} from '@/lib/preview/targetPreviewThumbnail';

export type { PinScope, TargetChainNode, TargetPreviewCaptureKind, TargetPreviewThumbnail };

export interface SelectedTargetInput {
  kind: 'section' | 'hero';
  sectionId?: string;
  analyticsId?: string;
  sectionIndex?: number;
  sectionType?: string;
  sectionTitle?: string;
  /** Optional element pin (Phase 3+). */
  fieldPath?: string;
  itemIndex?: number;
  elementKind?: string;
  elementLabel?: string;
  surfaceId?: string;
  targetChain?: TargetChainNode[];
  pinScope?: PinScope;
  previewThumbnail?: TargetPreviewThumbnail;
  /** Transient data URL before upload completes. */
  previewThumbnailDataUrl?: string;
  /** Source element rect width from drag capture (aspect-ratio layout). */
  previewCaptureWidth?: number;
  /** Source element rect height from drag capture (aspect-ratio layout). */
  previewCaptureHeight?: number;
}

function parseTargetChain(raw: unknown): TargetChainNode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const nodes: TargetChainNode[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry as Record<string, unknown>;
    const role = node.role;
    if (role !== 'section' && role !== 'container' && role !== 'item' && role !== 'element') {
      continue;
    }
    if (typeof node.label !== 'string' || !node.label.trim()) continue;
    const itemIndex =
      typeof node.itemIndex === 'number' && Number.isFinite(node.itemIndex)
        ? node.itemIndex
        : undefined;
    nodes.push({
      role,
      kind: typeof node.kind === 'string' ? node.kind.trim() : undefined,
      label: node.label.trim(),
      fieldPath: typeof node.fieldPath === 'string' ? node.fieldPath.trim() : undefined,
      itemIndex,
      itemPosition:
        typeof node.itemPosition === 'number' && Number.isFinite(node.itemPosition)
          ? node.itemPosition
          : itemIndex != null
            ? itemIndex + 1
            : undefined,
      surfaceId: typeof node.surfaceId === 'string' ? node.surfaceId.trim() : undefined,
    });
  }
  return nodes.length > 0 ? nodes : undefined;
}

function parsePreviewThumbnail(raw: unknown): TargetPreviewThumbnail | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  if (typeof input.previewUrl !== 'string' || !input.previewUrl.trim()) return undefined;
  return {
    previewUrl: input.previewUrl.trim(),
    publicUrl:
      typeof input.publicUrl === 'string' && input.publicUrl.trim()
        ? input.publicUrl.trim()
        : undefined,
    path: typeof input.path === 'string' && input.path.trim() ? input.path.trim() : undefined,
    width:
      typeof input.width === 'number' && Number.isFinite(input.width) ? input.width : undefined,
    height:
      typeof input.height === 'number' && Number.isFinite(input.height) ? input.height : undefined,
    captureKind:
      input.captureKind === 'raster' || input.captureKind === 'styled_fallback'
        ? input.captureKind
        : undefined,
  };
}

/** Normalize client/API selectedTarget to a consistent shape. */
export function normalizeSelectedTarget(
  raw: unknown
): SelectedTargetInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const kind = input.kind === 'hero' || input.kind === 'section' ? input.kind : undefined;
  if (!kind) return undefined;

  const sectionId =
    typeof input.sectionId === 'string' && input.sectionId.trim()
      ? input.sectionId.trim()
      : typeof input.analyticsId === 'string' && input.analyticsId.trim()
        ? input.analyticsId.trim()
        : undefined;

  const sectionIndex =
    typeof input.sectionIndex === 'number' && Number.isFinite(input.sectionIndex)
      ? input.sectionIndex
      : undefined;

  const sectionType =
    typeof input.sectionType === 'string' && input.sectionType.trim()
      ? input.sectionType.trim()
      : kind === 'hero'
        ? 'hero'
        : undefined;

  const sectionTitle =
    typeof input.sectionTitle === 'string' && input.sectionTitle.trim()
      ? input.sectionTitle.trim()
      : undefined;

  const fieldPath =
    typeof input.fieldPath === 'string' && input.fieldPath.trim()
      ? input.fieldPath.trim()
      : undefined;
  const itemIndex =
    typeof input.itemIndex === 'number' && Number.isFinite(input.itemIndex)
      ? input.itemIndex
      : undefined;
  const elementKind =
    typeof input.elementKind === 'string' && input.elementKind.trim()
      ? input.elementKind.trim()
      : undefined;
  const elementLabel =
    typeof input.elementLabel === 'string' && input.elementLabel.trim()
      ? input.elementLabel.trim()
      : undefined;
  const surfaceId =
    typeof input.surfaceId === 'string' && input.surfaceId.trim()
      ? input.surfaceId.trim()
      : undefined;
  const targetChain = parseTargetChain(input.targetChain);
  const pinScope =
    input.pinScope === 'element' || input.pinScope === 'section'
      ? input.pinScope
      : undefined;
  const previewThumbnail = parsePreviewThumbnail(input.previewThumbnail);
  const previewThumbnailDataUrl =
    typeof input.previewThumbnailDataUrl === 'string' && input.previewThumbnailDataUrl.trim()
      ? input.previewThumbnailDataUrl.trim()
      : undefined;
  const previewCaptureWidth =
    typeof input.previewCaptureWidth === 'number' && Number.isFinite(input.previewCaptureWidth)
      ? input.previewCaptureWidth
      : typeof input.previewWidth === 'number' && Number.isFinite(input.previewWidth)
        ? input.previewWidth
        : previewThumbnail?.width;
  const previewCaptureHeight =
    typeof input.previewCaptureHeight === 'number' && Number.isFinite(input.previewCaptureHeight)
      ? input.previewCaptureHeight
      : typeof input.previewHeight === 'number' && Number.isFinite(input.previewHeight)
        ? input.previewHeight
        : previewThumbnail?.height;

  const base: SelectedTargetInput =
    kind === 'hero'
      ? {
          kind: 'hero',
          sectionId: sectionId ?? 'hero',
          analyticsId: sectionId ?? 'hero',
          sectionType: 'hero',
          sectionTitle: sectionTitle ?? 'Hero',
          fieldPath,
          itemIndex,
          elementKind,
          elementLabel,
          surfaceId,
          targetChain,
          pinScope,
          previewThumbnail,
          previewThumbnailDataUrl,
          previewCaptureWidth,
          previewCaptureHeight,
        }
      : sectionId || sectionIndex != null
        ? {
            kind: 'section',
            sectionId,
            analyticsId:
              typeof input.analyticsId === 'string' && input.analyticsId.trim()
                ? input.analyticsId.trim()
                : sectionId,
            sectionIndex,
            sectionType,
            sectionTitle,
            fieldPath,
            itemIndex,
            elementKind,
            elementLabel,
            surfaceId,
            targetChain,
            pinScope,
            previewThumbnail,
            previewThumbnailDataUrl,
            previewCaptureWidth,
            previewCaptureHeight,
          }
        : (undefined as unknown as SelectedTargetInput);

  if (kind === 'section' && !sectionId && sectionIndex == null) return undefined;

  return enrichSelectedTarget(base);
}

/** DOM/analytics id used to highlight a section in the preview iframe. */
export function selectedTargetSectionId(target: SelectedTargetInput): string | undefined {
  if (target.kind === 'hero') return target.sectionId ?? target.analyticsId ?? 'hero';
  return target.sectionId ?? target.analyticsId;
}

export { allowedFieldPathsForTarget, resolvePinScope };

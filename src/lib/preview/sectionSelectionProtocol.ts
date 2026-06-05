/**
 * postMessage protocol for preview section selection (editor-only, proxy-injected).
 */

import type { PinScope, TargetChainNode } from '@/lib/preview/targetChain';
import type {
  TargetPreviewCaptureKind,
  TargetPreviewThumbnail,
} from '@/lib/preview/targetPreviewThumbnail';

export type { PinScope, TargetChainNode, TargetPreviewCaptureKind, TargetPreviewThumbnail };

export const PREVIEW_SECTION_MSG = {
  SELECTED: 'SITE_SECTION_SELECTED',
  DRAG_START: 'SITE_SECTION_DRAG_START',
  POINTER_DOWN: 'SITE_SECTION_POINTER_DOWN',
  HIGHLIGHT: 'SITE_SECTION_HIGHLIGHT',
  FOCUS: 'SITE_SECTION_FOCUS',
  DISMISS: 'SITE_SECTION_DISMISS',
  CLEAR: 'SITE_SECTION_CLEAR_SELECTION',
  ENABLE_MODE: 'SITE_SECTION_ENABLE_SELECTION',
  DISABLE_MODE: 'SITE_SECTION_DISABLE_SELECTION',
  PREVIEW_THUMB: 'SITE_SECTION_PREVIEW_THUMB',
  PARENT_DRAG_START: 'SITE_SECTION_PARENT_DRAG_START',
  DRAG_CANCEL: 'SITE_SECTION_DRAG_CANCEL',
} as const;

export type PreviewSectionMessageType =
  (typeof PREVIEW_SECTION_MSG)[keyof typeof PREVIEW_SECTION_MSG];

export interface SelectedSectionPayload {
  sectionId: string;
  analyticsId?: string;
  sectionIndex: number;
  sectionType: string;
  sectionTitle?: string;
  /** Optional inner-element pin from preview bridge drag. */
  elementKind?: string;
  elementLabel?: string;
  fieldPath?: string;
  itemIndex?: number;
  surfaceId?: string;
  targetChain?: TargetChainNode[];
  pinScope?: PinScope;
  previewThumbnail?: TargetPreviewThumbnail;
  previewThumbnailDataUrl?: string;
}

/** Context-menu payload includes iframe viewport coordinates for parent menu placement. */
export interface SiteSectionContextPayload extends SelectedSectionPayload {
  clientX: number;
  clientY: number;
  /** Pointer offset within the grabbed element (iframe coordinates). */
  grabOffsetX?: number;
  grabOffsetY?: number;
}

export interface SelectedSection {
  kind: 'section' | 'hero';
  sectionId: string;
  analyticsId?: string;
  sectionIndex?: number;
  sectionType: string;
  sectionTitle?: string;
  elementKind?: string;
  elementLabel?: string;
  fieldPath?: string;
  itemIndex?: number;
  surfaceId?: string;
  targetChain?: TargetChainNode[];
  pinScope?: PinScope;
  previewThumbnail?: TargetPreviewThumbnail;
  previewThumbnailDataUrl?: string;
}

export interface SiteSectionSelectedMessage {
  type: typeof PREVIEW_SECTION_MSG.SELECTED;
  payload: SelectedSectionPayload;
}

export interface SiteSectionDragStartMessage {
  type: typeof PREVIEW_SECTION_MSG.DRAG_START;
  payload: SiteSectionContextPayload;
}

export interface SiteSectionPointerDownMessage {
  type: typeof PREVIEW_SECTION_MSG.POINTER_DOWN;
  payload: SiteSectionContextPayload;
}

export interface SiteSectionHighlightMessage {
  type: typeof PREVIEW_SECTION_MSG.HIGHLIGHT;
  payload: { sectionId: string; hover?: boolean };
}

export interface SiteSectionFocusMessage {
  type: typeof PREVIEW_SECTION_MSG.FOCUS;
  payload: { sectionId: string };
}

export interface SiteSectionDismissMessage {
  type: typeof PREVIEW_SECTION_MSG.DISMISS;
}

export interface SiteSectionClearMessage {
  type: typeof PREVIEW_SECTION_MSG.CLEAR;
}

export interface SiteSectionEnableModeMessage {
  type: typeof PREVIEW_SECTION_MSG.ENABLE_MODE;
}

export interface SiteSectionDisableModeMessage {
  type: typeof PREVIEW_SECTION_MSG.DISABLE_MODE;
}

export interface SiteSectionPreviewThumbMessage {
  type: typeof PREVIEW_SECTION_MSG.PREVIEW_THUMB;
  payload: {
    sectionId: string;
    surfaceId?: string;
    fieldPath?: string;
    dataUrl: string;
    captureKind: TargetPreviewCaptureKind;
    width: number;
    height: number;
  };
}

export interface SiteSectionParentDragStartMessage {
  type: typeof PREVIEW_SECTION_MSG.PARENT_DRAG_START;
  payload: { started: true };
}

export interface SiteSectionDragCancelMessage {
  type: typeof PREVIEW_SECTION_MSG.DRAG_CANCEL;
}

export type ParentToIframeSectionMessage =
  | SiteSectionHighlightMessage
  | SiteSectionFocusMessage
  | SiteSectionClearMessage
  | SiteSectionEnableModeMessage
  | SiteSectionDisableModeMessage
  | SiteSectionParentDragStartMessage
  | SiteSectionDragCancelMessage;

export type IframeToParentSectionMessage =
  | SiteSectionSelectedMessage
  | SiteSectionDragStartMessage
  | SiteSectionPointerDownMessage
  | SiteSectionDismissMessage
  | SiteSectionPreviewThumbMessage;

const ALLOWED_PARENT_TYPES = new Set<string>([
  PREVIEW_SECTION_MSG.HIGHLIGHT,
  PREVIEW_SECTION_MSG.FOCUS,
  PREVIEW_SECTION_MSG.CLEAR,
  PREVIEW_SECTION_MSG.ENABLE_MODE,
  PREVIEW_SECTION_MSG.DISABLE_MODE,
  PREVIEW_SECTION_MSG.PARENT_DRAG_START,
  PREVIEW_SECTION_MSG.DRAG_CANCEL,
]);

const ALLOWED_IFRAME_TYPES = new Set<string>([
  PREVIEW_SECTION_MSG.SELECTED,
  PREVIEW_SECTION_MSG.DRAG_START,
  PREVIEW_SECTION_MSG.POINTER_DOWN,
  PREVIEW_SECTION_MSG.DISMISS,
  PREVIEW_SECTION_MSG.PREVIEW_THUMB,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseTargetChainNode(raw: unknown): TargetChainNode | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.label)) return null;
  const role = raw.role;
  if (role !== 'section' && role !== 'container' && role !== 'item' && role !== 'element') {
    return null;
  }
  const itemIndex =
    typeof raw.itemIndex === 'number' && Number.isFinite(raw.itemIndex) ? raw.itemIndex : undefined;
  const itemPosition =
    typeof raw.itemPosition === 'number' && Number.isFinite(raw.itemPosition)
      ? raw.itemPosition
      : itemIndex != null
        ? itemIndex + 1
        : undefined;
  return {
    role,
    kind: isNonEmptyString(raw.kind) ? raw.kind.trim() : undefined,
    label: raw.label.trim(),
    fieldPath: isNonEmptyString(raw.fieldPath) ? raw.fieldPath.trim() : undefined,
    itemIndex,
    itemPosition,
    surfaceId: isNonEmptyString(raw.surfaceId) ? raw.surfaceId.trim() : undefined,
  };
}

function parseTargetChain(raw: unknown): TargetChainNode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const nodes = raw.map(parseTargetChainNode).filter((n): n is TargetChainNode => n != null);
  return nodes.length > 0 ? nodes : undefined;
}

function parseSelectedSectionPayload(payload: Record<string, unknown>): SelectedSectionPayload | null {
  if (!isNonEmptyString(payload.sectionId)) return null;
  if (!isNonEmptyString(payload.sectionType)) return null;
  if (typeof payload.sectionIndex !== 'number' || !Number.isFinite(payload.sectionIndex)) {
    return null;
  }

  const elementKind = isNonEmptyString(payload.elementKind) ? payload.elementKind.trim() : undefined;
  const elementLabel = isNonEmptyString(payload.elementLabel) ? payload.elementLabel.trim() : undefined;
  const fieldPath = isNonEmptyString(payload.fieldPath) ? payload.fieldPath.trim() : undefined;
  const itemIndex =
    typeof payload.itemIndex === 'number' && Number.isFinite(payload.itemIndex)
      ? payload.itemIndex
      : undefined;
  const surfaceId = isNonEmptyString(payload.surfaceId) ? payload.surfaceId.trim() : undefined;
  const targetChain = parseTargetChain(payload.targetChain);
  const pinScope =
    payload.pinScope === 'element' || payload.pinScope === 'section'
      ? payload.pinScope
      : fieldPath
        ? 'element'
        : undefined;
  const previewThumbnail = parsePreviewThumbnail(payload.previewThumbnail);
  const previewThumbnailDataUrl = isNonEmptyString(payload.previewThumbnailDataUrl)
    ? payload.previewThumbnailDataUrl.trim()
    : undefined;

  return {
    sectionId: payload.sectionId.trim(),
    analyticsId: isNonEmptyString(payload.analyticsId) ? payload.analyticsId.trim() : undefined,
    sectionIndex: payload.sectionIndex,
    sectionType: payload.sectionType.trim(),
    sectionTitle: isNonEmptyString(payload.sectionTitle) ? payload.sectionTitle.trim() : undefined,
    elementKind,
    elementLabel,
    fieldPath,
    itemIndex,
    surfaceId,
    targetChain,
    pinScope,
    previewThumbnail,
    previewThumbnailDataUrl,
  };
}

/** Parse iframe → parent SITE_SECTION_PREVIEW_THUMB message. */
export function parseSiteSectionPreviewThumbMessage(
  data: unknown
): SiteSectionPreviewThumbMessage | null {
  if (!isRecord(data) || data.type !== PREVIEW_SECTION_MSG.PREVIEW_THUMB) return null;
  if (!isRecord(data.payload)) return null;
  const payload = data.payload;
  if (!isNonEmptyString(payload.sectionId)) return null;
  if (!isNonEmptyString(payload.dataUrl)) return null;
  if (payload.captureKind !== 'raster' && payload.captureKind !== 'styled_fallback') return null;
  if (typeof payload.width !== 'number' || !Number.isFinite(payload.width)) return null;
  if (typeof payload.height !== 'number' || !Number.isFinite(payload.height)) return null;

  return {
    type: PREVIEW_SECTION_MSG.PREVIEW_THUMB,
    payload: {
      sectionId: payload.sectionId.trim(),
      surfaceId: isNonEmptyString(payload.surfaceId) ? payload.surfaceId.trim() : undefined,
      fieldPath: isNonEmptyString(payload.fieldPath) ? payload.fieldPath.trim() : undefined,
      dataUrl: payload.dataUrl.trim(),
      captureKind: payload.captureKind,
      width: payload.width,
      height: payload.height,
    },
  };
}

function parsePreviewThumbnail(raw: unknown): TargetPreviewThumbnail | undefined {
  if (!isRecord(raw) || !isNonEmptyString(raw.previewUrl)) return undefined;
  return {
    previewUrl: raw.previewUrl.trim(),
    publicUrl: isNonEmptyString(raw.publicUrl) ? raw.publicUrl.trim() : undefined,
    path: isNonEmptyString(raw.path) ? raw.path.trim() : undefined,
    width: typeof raw.width === 'number' && Number.isFinite(raw.width) ? raw.width : undefined,
    height: typeof raw.height === 'number' && Number.isFinite(raw.height) ? raw.height : undefined,
    captureKind:
      raw.captureKind === 'raster' || raw.captureKind === 'styled_fallback'
        ? raw.captureKind
        : undefined,
  };
}
export function parseSiteSectionSelectedMessage(data: unknown): SiteSectionSelectedMessage | null {
  if (!isRecord(data) || data.type !== PREVIEW_SECTION_MSG.SELECTED) return null;
  if (!isRecord(data.payload)) return null;

  const parsed = parseSelectedSectionPayload(data.payload);
  if (!parsed) return null;

  return { type: PREVIEW_SECTION_MSG.SELECTED, payload: parsed };
}

/** Parse iframe → parent SITE_SECTION_DRAG_START message. */
export function parseSiteSectionDragStartMessage(data: unknown): SiteSectionDragStartMessage | null {
  if (!isRecord(data) || data.type !== PREVIEW_SECTION_MSG.DRAG_START) return null;
  if (!isRecord(data.payload)) return null;

  const parsed = parseContextPayload(data.payload);
  if (!parsed) return null;

  return { type: PREVIEW_SECTION_MSG.DRAG_START, payload: parsed };
}

/** Parse iframe → parent SITE_SECTION_POINTER_DOWN message (drag threshold tracked in parent). */
export function parseSiteSectionPointerDownMessage(
  data: unknown
): SiteSectionPointerDownMessage | null {
  if (!isRecord(data) || data.type !== PREVIEW_SECTION_MSG.POINTER_DOWN) return null;
  if (!isRecord(data.payload)) return null;

  const parsed = parseContextPayload(data.payload);
  if (!parsed) return null;

  return { type: PREVIEW_SECTION_MSG.POINTER_DOWN, payload: parsed };
}

function parseContextPayload(payload: Record<string, unknown>): SiteSectionContextPayload | null {
  const parsed = parseSelectedSectionPayload(payload);
  if (!parsed) return null;

  const { clientX, clientY, grabOffsetX, grabOffsetY } = payload;
  if (typeof clientX !== 'number' || !Number.isFinite(clientX)) return null;
  if (typeof clientY !== 'number' || !Number.isFinite(clientY)) return null;

  return {
    ...parsed,
    clientX,
    clientY,
    grabOffsetX:
      typeof grabOffsetX === 'number' && Number.isFinite(grabOffsetX) ? grabOffsetX : undefined,
    grabOffsetY:
      typeof grabOffsetY === 'number' && Number.isFinite(grabOffsetY) ? grabOffsetY : undefined,
  };
}

/** Map validated selection payload to UI state. */
export function selectedSectionFromPayload(payload: SelectedSectionPayload): SelectedSection {
  const kind =
    payload.sectionType === 'nav'
      ? 'section'
      : payload.sectionType === 'hero' || payload.sectionIndex < 0
        ? 'hero'
        : 'section';
  return {
    kind,
    sectionId: payload.sectionId,
    analyticsId: payload.analyticsId ?? payload.sectionId,
    sectionIndex: kind === 'section' ? payload.sectionIndex : undefined,
    sectionType: payload.sectionType,
    sectionTitle: payload.sectionTitle,
    elementKind: payload.elementKind,
    elementLabel: payload.elementLabel,
    fieldPath: payload.fieldPath,
    itemIndex: payload.itemIndex,
    surfaceId: payload.surfaceId,
    targetChain: payload.targetChain,
    pinScope: payload.pinScope ?? (payload.fieldPath ? 'element' : 'section'),
    previewThumbnail: payload.previewThumbnail,
    previewThumbnailDataUrl: payload.previewThumbnailDataUrl,
  };
}

/** Build parent → iframe signal to capture drag target preview thumbnail. */
export function buildSiteSectionParentDragStartMessage(): SiteSectionParentDragStartMessage {
  return { type: PREVIEW_SECTION_MSG.PARENT_DRAG_START, payload: { started: true } };
}

/** Build parent → iframe signal to cancel an in-progress drag. */
export function buildSiteSectionDragCancelMessage(): SiteSectionDragCancelMessage {
  return { type: PREVIEW_SECTION_MSG.DRAG_CANCEL };
}

/** Build parent → iframe highlight message. */
export function buildSiteSectionHighlightMessage(
  sectionId: string,
  hover = false
): SiteSectionHighlightMessage {
  return {
    type: PREVIEW_SECTION_MSG.HIGHLIGHT,
    payload: hover ? { sectionId, hover: true } : { sectionId },
  };
}

/** Build parent → iframe focus message (highlight + scroll into view). */
export function buildSiteSectionFocusMessage(sectionId: string): SiteSectionFocusMessage {
  return { type: PREVIEW_SECTION_MSG.FOCUS, payload: { sectionId } };
}

/** Parse iframe → parent dismiss (click outside section in preview). */
export function parseSiteSectionDismissMessage(data: unknown): SiteSectionDismissMessage | null {
  if (!isRecord(data) || data.type !== PREVIEW_SECTION_MSG.DISMISS) return null;
  return { type: PREVIEW_SECTION_MSG.DISMISS };
}

/** Build parent → iframe clear message. */
export function buildSiteSectionClearMessage(): SiteSectionClearMessage {
  return { type: PREVIEW_SECTION_MSG.CLEAR };
}

/** Build parent → iframe enable selection mode message. */
export function buildSiteSectionEnableModeMessage(): SiteSectionEnableModeMessage {
  return { type: PREVIEW_SECTION_MSG.ENABLE_MODE };
}

/** Build parent → iframe disable selection mode message. */
export function buildSiteSectionDisableModeMessage(): SiteSectionDisableModeMessage {
  return { type: PREVIEW_SECTION_MSG.DISABLE_MODE };
}

/** Validate parent → iframe outbound message shape before postMessage. */
export function isValidParentToIframeSectionMessage(data: unknown): data is ParentToIframeSectionMessage {
  if (!isRecord(data) || typeof data.type !== 'string') return false;
  if (!ALLOWED_PARENT_TYPES.has(data.type)) return false;

  if (data.type === PREVIEW_SECTION_MSG.HIGHLIGHT || data.type === PREVIEW_SECTION_MSG.FOCUS) {
    return isRecord(data.payload) && isNonEmptyString(data.payload.sectionId);
  }

  return (
    data.type === PREVIEW_SECTION_MSG.CLEAR ||
    data.type === PREVIEW_SECTION_MSG.ENABLE_MODE ||
    data.type === PREVIEW_SECTION_MSG.DISABLE_MODE ||
    (data.type === PREVIEW_SECTION_MSG.PARENT_DRAG_START &&
      isRecord(data.payload) &&
      data.payload.started === true) ||
    data.type === PREVIEW_SECTION_MSG.DRAG_CANCEL
  );
}

/** Validate iframe → parent message type allowlist. */
export function isAllowedIframeSectionMessageType(type: unknown): type is PreviewSectionMessageType {
  return typeof type === 'string' && ALLOWED_IFRAME_TYPES.has(type);
}

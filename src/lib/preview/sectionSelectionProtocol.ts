/**
 * postMessage protocol for preview section selection (editor-only, proxy-injected).
 */

export const PREVIEW_SECTION_MSG = {
  SELECTED: 'SITE_SECTION_SELECTED',
  DRAG_START: 'SITE_SECTION_DRAG_START',
  HIGHLIGHT: 'SITE_SECTION_HIGHLIGHT',
  FOCUS: 'SITE_SECTION_FOCUS',
  DISMISS: 'SITE_SECTION_DISMISS',
  CLEAR: 'SITE_SECTION_CLEAR_SELECTION',
  ENABLE_MODE: 'SITE_SECTION_ENABLE_SELECTION',
  DISABLE_MODE: 'SITE_SECTION_DISABLE_SELECTION',
} as const;

export type PreviewSectionMessageType =
  (typeof PREVIEW_SECTION_MSG)[keyof typeof PREVIEW_SECTION_MSG];

export interface SelectedSectionPayload {
  sectionId: string;
  analyticsId?: string;
  sectionIndex: number;
  sectionType: string;
  sectionTitle?: string;
}

/** Context-menu payload includes iframe viewport coordinates for parent menu placement. */
export interface SiteSectionContextPayload extends SelectedSectionPayload {
  clientX: number;
  clientY: number;
}

export interface SelectedSection {
  kind: 'section' | 'hero';
  sectionId: string;
  analyticsId?: string;
  sectionIndex?: number;
  sectionType: string;
  sectionTitle?: string;
}

export interface SiteSectionSelectedMessage {
  type: typeof PREVIEW_SECTION_MSG.SELECTED;
  payload: SelectedSectionPayload;
}

export interface SiteSectionDragStartMessage {
  type: typeof PREVIEW_SECTION_MSG.DRAG_START;
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

export type ParentToIframeSectionMessage =
  | SiteSectionHighlightMessage
  | SiteSectionFocusMessage
  | SiteSectionClearMessage
  | SiteSectionEnableModeMessage
  | SiteSectionDisableModeMessage;

export type IframeToParentSectionMessage =
  | SiteSectionSelectedMessage
  | SiteSectionDragStartMessage
  | SiteSectionDismissMessage;

const ALLOWED_PARENT_TYPES = new Set<string>([
  PREVIEW_SECTION_MSG.HIGHLIGHT,
  PREVIEW_SECTION_MSG.FOCUS,
  PREVIEW_SECTION_MSG.CLEAR,
  PREVIEW_SECTION_MSG.ENABLE_MODE,
  PREVIEW_SECTION_MSG.DISABLE_MODE,
]);

const ALLOWED_IFRAME_TYPES = new Set<string>([
  PREVIEW_SECTION_MSG.SELECTED,
  PREVIEW_SECTION_MSG.DRAG_START,
  PREVIEW_SECTION_MSG.DISMISS,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseSelectedSectionPayload(payload: Record<string, unknown>): SelectedSectionPayload | null {
  if (!isNonEmptyString(payload.sectionId)) return null;
  if (!isNonEmptyString(payload.sectionType)) return null;
  if (typeof payload.sectionIndex !== 'number' || !Number.isFinite(payload.sectionIndex)) {
    return null;
  }

  return {
    sectionId: payload.sectionId.trim(),
    analyticsId: isNonEmptyString(payload.analyticsId) ? payload.analyticsId.trim() : undefined,
    sectionIndex: payload.sectionIndex,
    sectionType: payload.sectionType.trim(),
    sectionTitle: isNonEmptyString(payload.sectionTitle) ? payload.sectionTitle.trim() : undefined,
  };
}

/** Parse iframe → parent SITE_SECTION_SELECTED message. */
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

function parseContextPayload(payload: Record<string, unknown>): SiteSectionContextPayload | null {
  const parsed = parseSelectedSectionPayload(payload);
  if (!parsed) return null;

  const { clientX, clientY } = payload;
  if (typeof clientX !== 'number' || !Number.isFinite(clientX)) return null;
  if (typeof clientY !== 'number' || !Number.isFinite(clientY)) return null;

  return { ...parsed, clientX, clientY };
}

/** Map validated selection payload to UI state. */
export function selectedSectionFromPayload(payload: SelectedSectionPayload): SelectedSection {
  const kind = payload.sectionType === 'hero' || payload.sectionIndex < 0 ? 'hero' : 'section';
  return {
    kind,
    sectionId: payload.sectionId,
    analyticsId: payload.analyticsId ?? payload.sectionId,
    sectionIndex: kind === 'section' ? payload.sectionIndex : undefined,
    sectionType: payload.sectionType,
    sectionTitle: payload.sectionTitle,
  };
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
    data.type === PREVIEW_SECTION_MSG.DISABLE_MODE
  );
}

/** Validate iframe → parent message type allowlist. */
export function isAllowedIframeSectionMessageType(type: unknown): type is PreviewSectionMessageType {
  return typeof type === 'string' && ALLOWED_IFRAME_TYPES.has(type);
}

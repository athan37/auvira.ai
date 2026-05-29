import type { VerifyPreviewResult } from './verifyEditVisibleInPreview';

export type PreviewVerifyStatus = 'synced' | 'pending' | 'failed';

const LOADING_HTML_MARKERS = [
  'Loading preview',
  'Preview is starting',
  'Preview server stopped',
  'Preview not ready',
  '<title>Loading preview</title>',
];

const SOFT_REASON_FRAGMENTS = [
  'fetch failed',
  'aborted due to timeout',
  'timeout',
  'timed out',
  'preview fetch failed',
  'preview html too short',
  'did not return usable html',
  'unhealthy',
  'econnrefused',
  'connection refused',
  'stale',
  'proxy',
  'restarting',
  'not ready',
  'still syncing',
];

/**
 * Detect placeholder / loading HTML served while preview restarts.
 */
export function isPreviewLoadingHtml(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length < 200) return true;
  const lower = trimmed.toLowerCase();
  return LOADING_HTML_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

/**
 * Transient preview issues — source edit may still be authoritative.
 */
export function isSoftPreviewPendingFailure(reason: string, html?: string): boolean {
  const lower = reason.toLowerCase();
  if (SOFT_REASON_FRAGMENTS.some((frag) => lower.includes(frag))) {
    return true;
  }
  if (html && isPreviewLoadingHtml(html)) {
    return true;
  }
  return false;
}

export interface EditStreamPreviewOutcomeInput {
  /** Workspace validation / build check passed. */
  sourceValidationPassed: boolean;
  /** Agent applied file changes that passed validation. */
  editApplied: boolean;
  previewVerify: Pick<VerifyPreviewResult, 'ok' | 'reason'> & { htmlLength?: number };
  /** Preview verify was not run (no URL, etc.). */
  previewVerifySkipped?: boolean;
  defaultSuccessMessage?: string;
}

export interface EditStreamPreviewOutcome {
  ok: boolean;
  editApplied: boolean;
  previewSynced: boolean;
  previewVerifyStatus?: PreviewVerifyStatus;
  previewVerifyReason?: string;
  ownerMessage: string;
}

const PREVIEW_SYNCING_MESSAGE =
  'Saved. Preview is still syncing; refresh in a moment.';

/**
 * Resolve edit stream success vs failure from source validation vs preview sync.
 * Only source validation failure marks the edit as failed.
 */
export function resolveEditStreamPreviewOutcome(
  input: EditStreamPreviewOutcomeInput
): EditStreamPreviewOutcome {
  const {
    sourceValidationPassed,
    editApplied,
    previewVerify,
    previewVerifySkipped,
    defaultSuccessMessage = 'Updated your website.',
  } = input;

  if (!sourceValidationPassed || !editApplied) {
    return {
      ok: false,
      editApplied: false,
      previewSynced: false,
      previewVerifyStatus: 'failed',
      previewVerifyReason: previewVerify.reason,
      ownerMessage: 'The change could not be saved.',
    };
  }

  if (previewVerifySkipped || previewVerify.ok) {
    return {
      ok: true,
      editApplied: true,
      previewSynced: true,
      previewVerifyStatus: 'synced',
      previewVerifyReason: previewVerifySkipped ? 'skipped' : previewVerify.reason,
      ownerMessage: defaultSuccessMessage,
    };
  }

  return {
    ok: true,
    editApplied: true,
    previewSynced: false,
    previewVerifyStatus: 'pending',
    previewVerifyReason: previewVerify.reason,
    ownerMessage: PREVIEW_SYNCING_MESSAGE,
  };
}

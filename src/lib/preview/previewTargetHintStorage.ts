export const PREVIEW_TARGET_HINT_STORAGE_KEY = 'editor-preview-target-hint-dismissed';

/** Whether the first-run preview targeting hint was dismissed or completed. */
export function isPreviewTargetHintDismissed(): boolean {
  try {
    return localStorage.getItem(PREVIEW_TARGET_HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist dismissal after first successful pin or manual dismiss. */
export function dismissPreviewTargetHint(): void {
  try {
    localStorage.setItem(PREVIEW_TARGET_HINT_STORAGE_KEY, '1');
  } catch {
    /* localStorage unavailable */
  }
}

export function shouldShowPreviewTargetHint(options: {
  previewReady: boolean;
  previewTargetingAvailable: boolean;
  hasSelectedTarget: boolean;
  dismissed: boolean;
}): boolean {
  return (
    options.previewReady &&
    options.previewTargetingAvailable &&
    !options.hasSelectedTarget &&
    !options.dismissed
  );
}

/** Activate a preview target chip (click or keyboard). */
export function activatePreviewTargetChip(options: {
  onActivate?: () => void;
  refocusInput?: () => void;
}): void {
  options.onActivate?.();
  options.refocusInput?.();
}

/** Handle keyboard activation for an interactive preview target chip. */
export function handlePreviewTargetChipKeyDown(
  event: { key: string; preventDefault: () => void },
  onActivate?: () => void,
  refocusInput?: () => void
): void {
  if (!onActivate) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activatePreviewTargetChip({ onActivate, refocusInput });
}

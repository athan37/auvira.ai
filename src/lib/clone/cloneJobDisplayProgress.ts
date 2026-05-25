/** Owner-facing progress caps — bar should not read 100% until deploy is complete. */
const STATUS_PROGRESS_CAP: Record<string, number> = {
  queued: 8,
  crawling: 28,
  extracting: 42,
  planning: 48,
  review_ready: 50,
  preview_building: 72,
  preview_ready: 78,
  building: 92,
  deploying: 98,
  completed: 100,
  failed: 50,
};

/**
 * Maps stored clone-job progress to a display percent aligned with journey phase.
 */
export function getCloneJobDisplayProgress(status: string, storedPercent: number): number {
  if (status === 'completed' || status === 'ready') return 100;
  const cap = STATUS_PROGRESS_CAP[status];
  if (cap == null) return Math.min(storedPercent, 99);
  if (status === 'failed') return Math.min(storedPercent, cap);
  return Math.min(cap, storedPercent);
}

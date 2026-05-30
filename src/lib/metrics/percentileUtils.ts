/** Shared percentile helpers for metrics aggregation. */

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

export function computePercentilesFromValues(values: number[]): { p50Ms: number; p95Ms: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return { p50Ms: percentile(sorted, 50), p95Ms: percentile(sorted, 95) };
}

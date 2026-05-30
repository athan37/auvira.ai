import { describe, expect, it } from 'vitest';
import { computePercentilesFromValues } from '@/lib/metrics/percentileUtils';

describe('percentileUtils', () => {
  it('computes p50 and p95', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const { p50Ms, p95Ms } = computePercentilesFromValues(values);
    expect(p50Ms).toBe(50);
    expect(p95Ms).toBe(100);
  });
});

describe('clientVitals', () => {
  it('records iframe reload count', async () => {
    const { recordIframeReload, getIframeReloadCount, resetEditorVitalsForTests } = await import(
      '@/lib/metrics/clientVitals'
    );
    resetEditorVitalsForTests();
    expect(recordIframeReload('p1')).toBe(1);
    expect(getIframeReloadCount()).toBe(1);
    expect(recordIframeReload('p1')).toBe(2);
    resetEditorVitalsForTests();
  });
});

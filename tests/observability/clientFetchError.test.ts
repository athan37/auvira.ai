import { describe, expect, it } from 'vitest';
import { formatObservabilityFetchError } from '@/lib/observability/client';

describe('formatObservabilityFetchError', () => {
  it('maps abort errors to timeout message', () => {
    const error = new DOMException('The operation was aborted.', 'AbortError');
    expect(formatObservabilityFetchError(error, 5000)).toBe(
      'Site Monitor request timed out after 5000ms'
    );
  });
});

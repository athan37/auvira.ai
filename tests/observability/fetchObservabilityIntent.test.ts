import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchObservabilityIntent, parseObservabilityProjectIntent } from '@/lib/observability/fetchObservabilityIntent';

vi.mock('@/lib/observability/client', () => ({
  fetchObservabilityIntentRaw: vi.fn(),
}));

import { fetchObservabilityIntentRaw } from '@/lib/observability/client';

describe('parseObservabilityProjectIntent', () => {
  it('parses keywords, intents, and turn_count', () => {
    const parsed = parseObservabilityProjectIntent({
      keywords: ['blue', 'cta'],
      intents: [{ label: 'color edit', count: 3 }],
      turn_count: 4,
      updated_at: '2026-06-08T00:00:00Z',
    });
    expect(parsed.keywords).toEqual(['blue', 'cta']);
    expect(parsed.intents).toEqual([{ label: 'color edit', count: 3 }]);
    expect(parsed.turn_count).toBe(4);
  });
});

describe('fetchObservabilityIntent', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    vi.mocked(fetchObservabilityIntentRaw).mockReset();
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns null when observability is disabled', async () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    const result = await fetchObservabilityIntent('proj-1');
    expect(result).toBeNull();
    expect(fetchObservabilityIntentRaw).not.toHaveBeenCalled();
  });

  it('returns null on 404 from client', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue(null);
    const result = await fetchObservabilityIntent('proj-1');
    expect(result).toBeNull();
  });

  it('returns parsed intent on success', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue({
      keywords: ['brand blue'],
      intents: [{ label: 'CTA Book Now', count: 2 }],
      turn_count: 2,
      updated_at: null,
    });
    const result = await fetchObservabilityIntent('proj-1');
    expect(result?.turn_count).toBe(2);
    expect(result?.keywords).toContain('brand blue');
  });
});

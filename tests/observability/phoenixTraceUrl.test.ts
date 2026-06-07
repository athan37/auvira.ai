import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { phoenixAppUrl, phoenixTraceUrl } from '@/lib/observability/config';

describe('phoenixTraceUrl', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns null for empty trace id', () => {
    expect(phoenixTraceUrl('')).toBeNull();
  });

  it('uses PHOENIX_TRACE_URL_TEMPLATE when set', () => {
    process.env.PHOENIX_TRACE_URL_TEMPLATE =
      'https://app.phoenix.arize.com/traces/{traceId}';
    expect(phoenixTraceUrl('trace-abc')).toBe(
      'https://app.phoenix.arize.com/traces/trace-abc'
    );
  });

  it('defaults phoenixAppUrl', () => {
    delete process.env.PHOENIX_APP_URL;
    expect(phoenixAppUrl()).toBe('https://app.phoenix.arize.com');
  });
});

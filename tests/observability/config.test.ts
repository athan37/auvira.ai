import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isObservabilityEnabled,
  isObservabilityCoachingEnabled,
} from '@/lib/observability/config';

describe('observability config flags', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('is disabled by default', () => {
    delete process.env.OBSERVABILITY_ENABLED;
    delete process.env.OBSERVABILITY_COACHING_ENABLED;
    expect(isObservabilityEnabled()).toBe(false);
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });

  it('requires API URL and key when enabled', () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    delete process.env.OBSERVABILITY_API_KEY;
    expect(isObservabilityEnabled()).toBe(false);
  });

  it('enables observability when configured', () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityEnabled()).toBe(true);
  });

  it('coaching requires observability master flag', () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });

  it('enables coaching only when both flags are on', () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityCoachingEnabled()).toBe(true);
  });
});

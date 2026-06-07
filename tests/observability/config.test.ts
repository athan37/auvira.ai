import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_OBSERVABILITY_API_URL,
  isObservabilityEnabled,
  isObservabilityCoachingEnabled,
  observabilityApiBaseUrl,
} from '@/lib/observability/config';

describe('observability config flags', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('is disabled without API key', () => {
    delete process.env.OBSERVABILITY_ENABLED;
    delete process.env.OBSERVABILITY_COACHING_ENABLED;
    delete process.env.OBSERVABILITY_API_KEY;
    expect(isObservabilityEnabled()).toBe(false);
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });

  it('defaults API URL to production monitor', () => {
    delete process.env.OBSERVABILITY_API_URL;
    expect(observabilityApiBaseUrl()).toBe(DEFAULT_OBSERVABILITY_API_URL);
  });

  it('enables observability by default when API key is configured', () => {
    delete process.env.OBSERVABILITY_ENABLED;
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityEnabled()).toBe(true);
  });

  it('OBSERVABILITY_ENABLED=0 opts out even with credentials', () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityEnabled()).toBe(false);
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });

  it('coaching is on by default when observability is configured', () => {
    delete process.env.OBSERVABILITY_ENABLED;
    delete process.env.OBSERVABILITY_COACHING_ENABLED;
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityCoachingEnabled()).toBe(true);
  });

  it('OBSERVABILITY_COACHING_ENABLED=0 disables coaching while recording stays on', () => {
    delete process.env.OBSERVABILITY_ENABLED;
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityEnabled()).toBe(true);
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });

  it('coaching requires observability master flag', () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    expect(isObservabilityCoachingEnabled()).toBe(false);
  });
});

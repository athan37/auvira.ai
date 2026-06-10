import { beforeAll, describe } from 'vitest';
import { observabilityApiKey } from '@/lib/observability/config';

export const OBSERVABILITY_INTEGRATION_TIMEOUT_MS = 30_000;

/** API key from env or bundled config/observability-public.env. */
export function hasObservabilityCredentials(): boolean {
  return Boolean(observabilityApiKey());
}

export function shouldRunObservabilityIntegrationTests(): boolean {
  return (
    hasObservabilityCredentials() &&
    process.env.RUN_OBSERVABILITY_INTEGRATION_TESTS === 'true'
  );
}

export function requireObservabilityCredentials(): void {
  if (hasObservabilityCredentials()) return;
  throw new Error(
    'Observability integration tests require a Monitor API key (bundled config/observability-public.env or OBSERVABILITY_API_KEY in .env). ' +
      'Run: npm run test:observability:live'
  );
}

/** Live monitor suite — gated by RUN_OBSERVABILITY_INTEGRATION_TESTS=true. */
export function observabilityIntegrationDescribe(name: string, fn: () => void): void {
  if (!shouldRunObservabilityIntegrationTests()) {
    describe.skip(name, fn);
    return;
  }
  describe(name, () => {
    beforeAll(() => {
      requireObservabilityCredentials();
    });
    fn();
  });
}

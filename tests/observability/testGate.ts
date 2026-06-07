import { beforeAll, describe } from 'vitest';

export const OBSERVABILITY_INTEGRATION_TIMEOUT_MS = 30_000;

/** API key present in .env (URL defaults to production in live tests). */
export function hasObservabilityCredentials(): boolean {
  return Boolean(process.env.OBSERVABILITY_API_KEY?.trim());
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
    'Observability integration tests require OBSERVABILITY_API_KEY in .env. ' +
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

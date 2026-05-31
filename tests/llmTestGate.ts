import { beforeAll, describe, vi } from 'vitest';

/** Per-test timeout for live LLM calls (planner + E2E). */
export const LLM_TEST_TIMEOUT_MS = 120_000;

/** Default Vitest retries when VITEST_LLM_SUITE=1 (see vitest.config.ts). */
export const LLM_TEST_RETRY = Math.max(
  0,
  parseInt(process.env.VITEST_LLM_RETRY ?? '2', 10) || 0
);

vi.setConfig({ testTimeout: LLM_TEST_TIMEOUT_MS });

/**
 * Live LLM tests load credentials from .env via `node --env-file=.env` on npm scripts.
 * Suites are never skipped when the key is present — they fail fast if it is missing.
 */
export function hasLlmApiKey(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY?.trim());
}

export function requireLlmApiKey(): void {
  if (hasLlmApiKey()) return;
  throw new Error(
    'Live LLM tests require MINIMAX_API_KEY in the project .env file. ' +
      'Run: npm run test:llm (loads .env automatically).'
  );
}

/**
 * Register a live LLM suite. Does not use describe.skip — missing keys fail in beforeAll.
 * Retries on failure are configured in vitest.config.ts when VITEST_LLM_SUITE=1.
 */
export function llmDescribe(name: string, fn: () => void): void {
  describe(name, () => {
    beforeAll(() => {
      requireLlmApiKey();
    });
    fn();
  });
}

/** @deprecated Use llmDescribe — same behavior. */
export const describeLlmIntegration = llmDescribe;

export function shouldRunLlmIntegrationTests(): boolean {
  return (
    hasLlmApiKey() &&
    (process.env.RUN_LLM_INTEGRATION_TESTS === 'true' ||
      process.env.VITEST_LLM_SUITE === '1')
  );
}

/**
 * Live LLM integration suite gated by RUN_LLM_INTEGRATION_TESTS=true (or test:llm).
 */
export function describeRunLlmIntegration(name: string, fn: () => void): void {
  if (!shouldRunLlmIntegrationTests()) {
    describe.skip(name, fn);
    return;
  }
  llmDescribe(name, fn);
}

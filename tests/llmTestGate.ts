import { beforeAll, describe, vi } from 'vitest';

/** Per-test timeout for live LLM calls (planner + E2E). */
export const LLM_TEST_TIMEOUT_MS = 120_000;

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
  return hasLlmApiKey();
}

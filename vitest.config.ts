import { defineConfig } from 'vitest/config';
import path from 'path';

/** Set by npm run test:llm* so Vitest includes live LLM suites and uses long timeouts. */
const runLlmSuite = process.env.VITEST_LLM_SUITE === '1';

/** Retries for flaky live-LLM assertions (default 2 → up to 3 attempts). Override with VITEST_LLM_RETRY. */
const llmRetry = runLlmSuite
  ? Math.max(0, parseInt(process.env.VITEST_LLM_RETRY ?? '2', 10) || 0)
  : 0;

const llmIntegrationFiles = [
  'tests/integration/edit-agent/sectionStylePreviewSync.integration.test.ts',
  'tests/integration/edit-agent/chatHistoryEdit.llm.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    testTimeout: runLlmSuite ? 120_000 : 5_000,
    retry: llmRetry,
    exclude: runLlmSuite
      ? ['**/node_modules/**', '**/.git/**']
      : [
          '**/node_modules/**',
          '**/.git/**',
          '**/*.llm.test.ts',
          ...llmIntegrationFiles,
        ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

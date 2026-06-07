import { defineConfig } from 'vitest/config';
import path from 'path';

/** Set by npm run test:llm* so Vitest includes live LLM suites and uses long timeouts. */
const runLlmSuite = process.env.VITEST_LLM_SUITE === '1';

/** Set by npm run test:observability:live for live Site Monitor calls. */
const runObservabilityIntegration = process.env.RUN_OBSERVABILITY_INTEGRATION_TESTS === 'true';

/** Retries for flaky live-LLM assertions (default 2 → up to 3 attempts). Override with VITEST_LLM_RETRY. */
const llmRetry = runLlmSuite
  ? Math.max(0, parseInt(process.env.VITEST_LLM_RETRY ?? '2', 10) || 0)
  : 0;

const llmIntegrationFiles = [
  'tests/integration/edit-agent/sectionStylePreviewSync.integration.test.ts',
  'tests/integration/edit-agent/chatHistoryEdit.llm.test.ts',
];

const observabilityIntegrationFiles = [
  'tests/observability/liveMonitor.observability.integration.test.ts',
  'tests/observability/accuracyComparison.observability.integration.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    testTimeout: runLlmSuite ? 120_000 : runObservabilityIntegration ? 30_000 : 5_000,
    retry: llmRetry,
    exclude: runLlmSuite
      ? ['**/node_modules/**', '**/.git/**']
      : [
          '**/node_modules/**',
          '**/.git/**',
          '**/*.llm.test.ts',
          ...llmIntegrationFiles,
          ...(runObservabilityIntegration ? [] : observabilityIntegrationFiles),
        ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

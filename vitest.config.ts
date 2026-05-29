import { defineConfig } from 'vitest/config';
import path from 'path';

/** Set by npm run test:llm* so Vitest includes live LLM suites and uses long timeouts. */
const runLlmSuite = process.env.VITEST_LLM_SUITE === '1';

const llmIntegrationFiles = [
  'tests/integration/website-agent-v2/websiteAgentV2.plan.integration.test.ts',
  'tests/integration/website-agent-v2/websiteAgentV2.clarification.integration.test.ts',
  'tests/integration/website-edit-agent/sectionStylePreviewSync.integration.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    testTimeout: runLlmSuite ? 120_000 : 5_000,
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

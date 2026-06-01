/**
 * LLM integration: inner-element style edits (cardClass) vs whole-section background.
 *
 * Run one scenario:
 *   VITEST_LLM_SUITE=1 node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/integration/edit-agent/innerElementStyle.llm.test.ts -t "services-cards-blue"
 *
 * Run all:
 *   npm run test:llm:inner-element
 */
import '../../llmTestGate';
import { describe, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import {
  assertInnerElementStyleContract,
  INNER_ELEMENT_STYLE_LLM_SCENARIOS,
  withInnerElementStyleScenario,
} from '../../support/innerElementStyleContract';

describeRunLlmIntegration('inner element style (LLM integration)', () => {
  for (const scenario of INNER_ELEMENT_STYLE_LLM_SCENARIOS) {
    it(
      scenario.id,
      async () => {
        await withInnerElementStyleScenario(scenario, async (run) => {
          assertInnerElementStyleContract({
            scenario,
            targetSectionIndex: run.targetSectionIndex,
            existingBackgroundClass: run.existingBackgroundClass,
            result: run.result,
            siteConfigAfter: run.siteConfigAfter,
          });
        });
      },
      LLM_TEST_TIMEOUT_MS
    );
  }
});

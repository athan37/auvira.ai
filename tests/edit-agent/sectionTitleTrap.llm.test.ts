/**
 * Live LLM planner checks for section-title traps across fixtures + normal-site smoke.
 */
import { expect, it, describe } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import {
  BASE_SITE_SPEC,
  planWithLiveLlm,
  styleStepSectionIndex,
} from '../support/planWithLiveLlm';
import {
  TRAP_FIXTURE_SUITES,
  quotedTitleStyleMessage,
  sectionTitledStyleMessage,
} from '../support/sectionTitleTrapExpectations';

function expectTrapPlanSafe(
  plan: Awaited<ReturnType<typeof planWithLiveLlm>>,
  forbiddenIndex: number,
  message: string
): void {
  if (plan.needsClarification) {
    expect(plan.steps.length).toBe(0);
    return;
  }

  const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
  const idx = styleStepSectionIndex(styleStep);
  expect(
    idx,
    `planner must not target forbidden index ${forbiddenIndex} for: ${message}`
  ).not.toBe(forbiddenIndex);
}

describeRunLlmIntegration('section title traps (LLM planner)', () => {
  for (const suite of TRAP_FIXTURE_SUITES) {
    describe(`fixture: ${suite.id}`, () => {
      for (const trap of suite.substringTraps) {
        it(
          `substring trap: "${trap.word}" must not hit [${trap.forbiddenIndex}]`,
          async () => {
            const message = sectionTitledStyleMessage(trap.word, trap.color);
            const plan = await planWithLiveLlm(message, suite.spec);
            expectTrapPlanSafe(plan, trap.forbiddenIndex, message);
          },
          LLM_TEST_TIMEOUT_MS
        );
      }

      for (const overlap of suite.wordOverlapMatches) {
        it(
          `word overlap: "${overlap.phrase}" resolves to [${overlap.expectedIndex}]`,
          async () => {
            const message = sectionTitledStyleMessage(overlap.phrase, overlap.color);
            const plan = await planWithLiveLlm(message, suite.spec);

            if (plan.needsClarification) {
              expect(plan.steps.length).toBe(0);
              return;
            }

            const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
            expect(styleStepSectionIndex(styleStep)).toBe(overlap.expectedIndex);
          },
          LLM_TEST_TIMEOUT_MS
        );
      }

      for (const exact of suite.exactTitleMatches) {
        it(
          `exact title: resolves [${exact.expectedIndex}]`,
          async () => {
            const message = quotedTitleStyleMessage(exact.title, exact.color);
            const plan = await planWithLiveLlm(message, suite.spec);

            expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
            const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
            expect(styleStepSectionIndex(styleStep)).toBe(exact.expectedIndex);
          },
          LLM_TEST_TIMEOUT_MS
        );
      }
    });
  }
});

describeRunLlmIntegration('section title traps — normal site smoke (LLM)', () => {
  it(
    'default multi-section site: first section ordinal still plans index 0',
    async () => {
      const plan = await planWithLiveLlm('change background of first section to yellow');

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
      expect(styleStepSectionIndex(styleStep)).toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'default multi-section site: unknown titled word clarifies',
    async () => {
      const plan = await planWithLiveLlm(
        sectionTitledStyleMessage('business', 'yellow'),
        BASE_SITE_SPEC
      );

      expect(plan.needsClarification).toBe(true);
      expect(plan.steps.length).toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'default multi-section site: quoted full section title resolves',
    async () => {
      const title = BASE_SITE_SPEC.sections[2]?.title ?? 'Section 3 (testimonials)';
      const plan = await planWithLiveLlm(
        `change background of "${title}" to blue`,
        BASE_SITE_SPEC
      );

      expect(plan.needsClarification, JSON.stringify(plan)).not.toBe(true);
      const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
      expect(styleStepSectionIndex(styleStep)).toBe(2);
    },
    LLM_TEST_TIMEOUT_MS
  );
});

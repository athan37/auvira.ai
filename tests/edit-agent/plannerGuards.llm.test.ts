/**
 * Live LLM: planner guardrails — clarification before unsafe plans.
 *
 * Run: npm run test:llm:edit-errors
 */
import { expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { planWithLiveLlm } from '../support/planWithLiveLlm';
import { confusingTitlesSiteSpec } from './editHarness';
import { defaultMultiSectionSiteSpec } from '../support/syntheticSiteWorkspace';

describeRunLlmIntegration('edit-agent planner guards (LLM)', () => {
  it(
    'hero copy without value: needsClarification or blocked empty value',
    async () => {
      const plan = await planWithLiveLlm('change the hero headline');

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      const heroStep = plan.steps.find((s) => s.skill === 'update_hero');
      if (heroStep) {
        const value = heroStep.params?.value;
        expect(String(value ?? '').trim().length).toBeGreaterThan(0);
      } else {
        expect(plan.steps.length).toBe(0);
      }
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'compound intent: make hero blue and add FAQ clarifies or single step',
    async () => {
      const plan = await planWithLiveLlm('make hero blue and add an FAQ section');

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      expect(plan.steps.length).toBeLessThanOrEqual(1);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'image without attachment: clarify or block replace_image',
    async () => {
      const plan = await planWithLiveLlm('replace the hero image');

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      const imageStep = plan.steps.find((s) => s.skill === 'replace_image');
      expect(imageStep, 'replace_image should not run without attachment').toBeUndefined();
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'vague improvement on 2-section site: clarifies without invented edits',
    async () => {
      const spec = {
        businessName: 'Two Section Site',
        sections: [
          { type: 'services', title: 'Our Services' },
          { type: 'contact', title: 'Contact Us' },
        ],
      };

      const plan = await planWithLiveLlm('make that section better', spec);

      if (!plan.needsClarification) {
        expect(plan.steps.length).toBeLessThanOrEqual(1);
        return;
      }

      expect(plan.steps.length).toBe(0);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'copy without value on named section: planner clarifies',
    async () => {
      const spec = defaultMultiSectionSiteSpec();
      const servicesTitle = spec.sections.find((s) => s.type === 'services')?.title ?? 'Services';

      const plan = await planWithLiveLlm(`update the text in the "${servicesTitle}" section`);

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      const copyStep = plan.steps.find((s) => s.skill === 'update_section_copy');
      if (copyStep) {
        expect(String(copyStep.params?.value ?? '').trim().length).toBeGreaterThan(0);
      }
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'deictic-only style on confusing site: planner clarifies or targets via catalog',
    async () => {
      const plan = await planWithLiveLlm(
        'change this section background to red',
        confusingTitlesSiteSpec()
      );

      if (plan.needsClarification) {
        expect(plan.steps.length).toBe(0);
        return;
      }

      const styleStep = plan.steps.find((s) => s.skill === 'update_section_style');
      expect(styleStep).toBeTruthy();
      const idx = styleStep?.target?.sectionIndex ?? styleStep?.params?.sectionIndex;
      expect(typeof idx).toBe('number');
    },
    LLM_TEST_TIMEOUT_MS
  );
});

import { expect, it } from 'vitest';
import { llmDescribe, planWithLiveLlm } from './llmIntegrationHarness';

const LLM_TEST_TIMEOUT_MS = 120_000;

llmDescribe('Website Agent V2 planEdit LLM integration', () => {
  it(
    'routes hero headline edits to update_hero',
    async () => {
    const plan = await planWithLiveLlm('Change the hero headline to "Built for Growth"');

    expect(plan.route).toBe('hero');
    expect(plan.needsClarification).not.toBe(true);
    expect(plan.steps.some((step) => step.skill === 'update_hero')).toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'asks for clarification when the requested value is missing',
    async () => {
    const plan = await planWithLiveLlm('Change the hero headline');

    expect(plan.needsClarification).toBe(true);
    expect(plan.route).toBe('clarify');
    expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'routes phone edits to update_contact',
    async () => {
    const plan = await planWithLiveLlm('Update the phone number to 555-0199');

    expect(plan.route).toBe('contact');
    expect(plan.needsClarification).not.toBe(true);
    expect(plan.steps.some((step) => step.skill === 'update_contact')).toBe(true);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'plans multiple coordinated edits in one request',
    async () => {
    const plan = await planWithLiveLlm(
      'Refresh the homepage: change hero headline to "Built for Growth", update phone to 555-0111, and add a service called "Maintenance Plans"'
    );

    if (plan.needsClarification) {
      expect(plan.route).toBe('clarify');
      expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
    } else {
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      const skills = new Set(plan.steps.map((step) => step.skill));
      expect(skills.has('update_hero')).toBe(true);
      expect(skills.has('update_contact') || skills.has('add_service')).toBe(true);
    }
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'asks for clarification on ambiguous, non-specific prompts',
    async () => {
    const plan = await planWithLiveLlm('Make that section better');

    expect(plan.needsClarification).toBe(true);
    expect(plan.route).toBe('clarify');
    expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
    },
    LLM_TEST_TIMEOUT_MS
  );
});


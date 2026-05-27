import { expect, it } from 'vitest';
import { llmDescribe, planWithLiveLlm } from './llmIntegrationHarness';

llmDescribe('Website Agent V2 planEdit LLM integration', () => {
  it('routes hero headline edits to update_hero', async () => {
    const plan = await planWithLiveLlm('Change the hero headline to "Built for Growth"');

    expect(plan.route).toBe('hero');
    expect(plan.needsClarification).not.toBe(true);
    expect(plan.steps.some((step) => step.skill === 'update_hero')).toBe(true);
  });

  it('asks for clarification when the requested value is missing', async () => {
    const plan = await planWithLiveLlm('Change the hero headline');

    expect(plan.needsClarification).toBe(true);
    expect(plan.route).toBe('clarify');
    expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
  });

  it('routes phone edits to update_contact', async () => {
    const plan = await planWithLiveLlm('Update the phone number to 555-0199');

    expect(plan.route).toBe('contact');
    expect(plan.needsClarification).not.toBe(true);
    expect(plan.steps.some((step) => step.skill === 'update_contact')).toBe(true);
  });
});


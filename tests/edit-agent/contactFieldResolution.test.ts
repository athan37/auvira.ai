import { describe, expect, it } from 'vitest';
import { buildVerificationContractFromPlan } from '@/lib/project-workspace/edit-context/buildVerificationContractFromPlan';
import { paramsForSkill } from '@/lib/project-workspace/tools/domain/registry';

describe('update_contact field resolution', () => {
  const message = 'change contact information to helllo this is david';
  const planParams = { value: 'helllo this is david', email: '1234@asdfasd.edu' };

  it('verification and execution agree on contact field when LLM echoes current email', () => {
    const plan = {
      planVersion: 'website-agent' as const,
      needsClarification: false,
      steps: [{ skill: 'update_contact' as const, params: planParams }],
    };
    const verification = buildVerificationContractFromPlan(plan, message);
    const execParams = paramsForSkill('update_contact', undefined, planParams, {
      effectiveMessage: message,
    } as never);

    const check = verification.checks.find((c) => c.kind === 'copy_field');
    expect(check?.field).toBe(`contact.${execParams.field}`);
    expect(check?.expectedValue).toBe(execParams.value);
  });
});

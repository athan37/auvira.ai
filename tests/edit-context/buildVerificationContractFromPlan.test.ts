import { describe, expect, it } from 'vitest';
import { buildVerificationContractFromPlan } from '@/lib/project-workspace/edit-context/buildVerificationContractFromPlan';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';

describe('buildVerificationContractFromPlan', () => {
  it('builds titleClass verification for heading color style steps', () => {
    const plan: EditPlan = {
      planVersion: 'website-agent',
      needsClarification: false,
      intent: 'style',
      steps: [
        {
          skill: 'update_section_style',
          target: { sectionIndex: 5, title: 'Upcoming Events' },
          params: {
            sectionIndex: 5,
            textClass: 'text-green-600',
            presentationField: 'titleClass',
          },
        },
      ],
    };

    const contract = buildVerificationContractFromPlan(plan);
    expect(contract.checks).toEqual([
      {
        kind: 'section_background',
        sectionIndex: 5,
        field: 'titleClass',
        expectedValue: 'text-green-600',
      },
    ]);
  });
});

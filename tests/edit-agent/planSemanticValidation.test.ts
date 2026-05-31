import { describe, expect, it } from 'vitest';
import { EditPlanSchema } from '@/lib/project-workspace/planner/editPlan.schema';
import { normalizeEditPlanPayload } from '@/lib/project-workspace/planner/normalizeEditPlan';
import { validateEditPlanSemantics } from '@/lib/project-workspace/planner/validateEditPlanSemantics';
import { validatePlanSkills } from '@/lib/project-workspace/planner/validatePlanSkills';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function minimalContext(overrides?: Partial<EditContext>): EditContext {
  return {
    workspacePath: '/tmp/test',
    mode: 'gitlab',
    ownerMessage: 'test',
    effectiveMessage: 'test',
    siteModel: { workspacePath: '/tmp/test', mode: 'gitlab', archetype: 'section-loop' } as unknown as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as unknown as EditContext['sectionCatalog'],
    sections: [],
    target: { kind: 'section', confidence: 'high', candidates: [], needsClarification: false },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: { level: 'low', compoundIntent: false, lowConfidenceTarget: false, infraNotReady: false, legacyArchetype: false, reasons: [] },
    verificationContract: { checks: [{ kind: 'generic' }] },
    infraBaselineReady: true,
    ...overrides,
  };
}

describe('validateEditPlanSemantics', () => {
  it('returns clarification when update_hero lacks value', () => {
    const plan = EditPlanSchema.parse({
      needsClarification: false,
      steps: [{ skill: 'update_hero', params: { field: 'headline' } }],
    });
    const result = validateEditPlanSemantics(plan, minimalContext());
    expect(result?.plan?.needsClarification).toBe(true);
    expect(result?.plan?.steps).toHaveLength(0);
  });

  it('coerces string sectionIndex via normalize and passes semantic validation', () => {
    const raw = {
      needsClarification: false,
      steps: [
        {
          skill: 'update_section_copy',
          params: { sectionIndex: '0', field: 'title', value: 'New title' },
        },
      ],
    };
    const plan = EditPlanSchema.parse(normalizeEditPlanPayload(raw));
    const result = validateEditPlanSemantics(
      plan,
      minimalContext({ target: { kind: 'section', sectionIndex: 0, confidence: 'high', candidates: [], needsClarification: false } })
    );
    expect(result).toBeNull();
  });

  it('blocks replace_image even with attachments flag', () => {
    const plan = EditPlanSchema.parse({
      needsClarification: false,
      steps: [{ skill: 'replace_image', params: {} }],
    });
    const blocked = validatePlanSkills(plan, { hasAttachments: true });
    expect(blocked?.plan?.needsClarification).toBe(true);
  });
});

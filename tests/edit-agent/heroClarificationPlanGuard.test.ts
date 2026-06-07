import { describe, expect, it } from 'vitest';
import { guardEditPlanSemantics } from '@/lib/project-workspace/planner/validateEditPlanSemantics';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';

function heroEditContext(): EditContext {
  return {
    workspacePath: '/tmp/test',
    mode: 'gitlab',
    ownerMessage: 'Blue to green gradient',
    effectiveMessage: 'improve hero background — follow-up: Blue to green gradient (target: hero)',
    siteModel: { siteConfigContent: '', pageContent: '', archetype: 'section-loop' } as EditContext['siteModel'],
    sectionCatalog: { sections: [], numberedReplies: [], textBlock: '' },
    sections: [],
    target: {
      kind: 'hero',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: { level: 'low', reasons: [] },
    verificationContract: { checks: [] },
    infraBaselineReady: true,
    conversationHistory: [
      { role: 'user', content: 'improve color of this section (hero section)' },
      {
        role: 'assistant',
        content: 'Which color would you like to improve on the hero section?',
      },
      { role: 'user', content: 'Background color' },
    ],
  } as EditContext;
}

describe('validateEditPlanSemantics hero guardrail', () => {
  it('blocks update_section_style during hero clarification thread', () => {
    const plan: EditPlan = {
      planVersion: 'website-agent',
      needsClarification: false,
      steps: [
        {
          skill: 'update_section_style',
          params: { sectionIndex: 1, backgroundColor: 'blue' },
        },
      ],
    };

    const guarded = guardEditPlanSemantics(plan, heroEditContext());
    expect(guarded.needsClarification).toBe(true);
    expect(guarded.steps).toHaveLength(0);
    expect(guarded.clarificationQuestion).toMatch(/hero background/i);
  });
});

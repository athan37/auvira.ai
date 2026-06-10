import { describe, expect, it } from 'vitest';
import { deriveProjectMemorySlots } from '@/lib/project-workspace/edit-context/projectMemoryWriter';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';

function baseContext(): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'make card my favorite color',
    effectiveMessage: 'make card my favorite color',
    siteModel: {} as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as EditContext['sectionCatalog'],
    sections: [{ index: 1, type: 'contact', title: 'Contact' }],
    target: {
      kind: 'section',
      sectionIndex: 1,
      sectionType: 'contact',
      title: 'Contact',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [] },
    infraBaselineReady: true,
  };
}

describe('projectMemoryWriter', () => {
  it('derives style_token and edit_pattern from update_section_style step', () => {
    const plan: EditPlan = {
      needsClarification: false,
      steps: [
        {
          skill: 'update_section_style',
          params: {
            sectionIndex: 1,
            presentationField: 'cardClass',
            backgroundClass: 'gradient-blue',
          },
        },
      ],
    };

    const slots = deriveProjectMemorySlots({
      plan,
      editContext: baseContext(),
      ownerMessage: 'use my favorite way to edit the card background',
      turnId: 'job-123',
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.some((s) => s.kind === 'style_token' && s.value === 'gradient-blue')).toBe(true);
    expect(slots[0]?.scope.type).toBe('section_type');
  });

  it('returns empty for clarification plans', () => {
    const slots = deriveProjectMemorySlots({
      plan: {
        needsClarification: true,
        clarificationQuestion: 'Which color?',
        suggestedReplies: ['Blue', 'Green'],
        steps: [],
      },
      editContext: baseContext(),
      ownerMessage: 'favorite color',
      turnId: 'job-1',
    });
    expect(slots).toEqual([]);
  });

  it('derives color slot from resolved implicit references', async () => {
    const { deriveMemorySlotsFromResolvedReferences } = await import(
      '@/lib/project-workspace/edit-context/projectMemoryWriter'
    );
    const slots = deriveMemorySlotsFromResolvedReferences({
      references: [
        {
          phrase: 'my favorite color',
          resolvedValue: 'green',
          resolvedKind: 'color',
          source: 'chat_history',
          confidence: 'high',
          reason: 'chat history',
        },
      ],
      editContext: baseContext(),
      ownerMessage: 'make background my favorite color',
      turnId: 'job-2',
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]?.kind).toBe('color');
    expect(slots[0]?.value).toBe('green');
  });
});

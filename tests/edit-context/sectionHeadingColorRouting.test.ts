import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { isTextColorEditRequest } from '@/lib/project-workspace/verifyPreviewHints';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function makePinnedSectionContext(message: string): EditContext {
  return {
    ownerMessage: message,
    effectiveMessage: message,
    target: {
      kind: 'section',
      sectionIndex: 2,
      title: 'Upcoming Events',
      sectionType: 'generic',
    },
    selectedTarget: {
      kind: 'section',
      sectionIndex: 2,
      sectionTitle: 'Upcoming Events',
      sectionType: 'generic',
    },
    selectedTargetContext: {
      target: {
        kind: 'section',
        sectionIndex: 2,
        sectionTitle: 'Upcoming Events',
        sectionType: 'generic',
      },
      resolved: {
        kind: 'section',
        sectionIndex: 2,
        sectionTitle: 'Upcoming Events',
        sectionType: 'generic',
        confidence: 'high',
      },
      editableFields: [],
      sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
    },
    siteModel: { siteConfigContent: '' },
    sections: [{ index: 2, title: 'Upcoming Events', type: 'generic' }],
    riskFlags: { level: 'low', reasons: [] },
    conversationHistory: [],
  } as unknown as EditContext;
}

describe('section heading color routing', () => {
  it('classifies heading color prompts as style_text', () => {
    expect(isTextColorEditRequest('change heading color to green')).toBe(true);
    expect(classifyEditWhat('change heading color to green')).toBe('style_text');
  });

  it('deterministic plan updates titleClass instead of section background', () => {
    const plan = buildDeterministicPlan(makePinnedSectionContext('change heading color to green'));
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_section_style');
    expect(plan?.steps[0]?.params?.presentationField).toBe('titleClass');
    expect(plan?.steps[0]?.params?.textClass).toBe('text-green-600');
    expect(plan?.steps[0]?.params?.backgroundClass).toBeUndefined();
  });
});

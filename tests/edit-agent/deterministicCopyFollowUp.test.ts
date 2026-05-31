import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function contextWithDuplicate(overrides: Partial<EditContext>): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'All-Star HVAC',
    effectiveMessage: 'All-Star HVAC',
    siteModel: {
      workspacePath: '/tmp',
      mode: 'gitlab',
      archetype: 'section-loop',
      siteConfigContent: `export const siteConfig = {
  "businessName": "Same Title",
  "hero": { "headline": "Same Title", "subheadline": "Sub" },
  "sections": [{ "type": "services", "title": "Services" }]
} as const;`,
      parsedConfig: {
        businessName: 'Same Title',
        hero: { headline: 'Same Title', subheadline: 'Sub' },
        sections: [{ type: 'services', title: 'Services' }],
      },
    } as unknown as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as unknown as EditContext['sectionCatalog'],
    sections: [{ index: 0, type: 'services', title: 'Services' }],
    target: { kind: 'hero', confidence: 'high', candidates: [], needsClarification: false },
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
    conversationHistory: [
      { role: 'user', content: 'change "Same Title" to hi' },
      { role: 'assistant', content: 'Which field?' },
      { role: 'user', content: 'Both the business name and hero headline' },
      { role: 'assistant', content: 'What should the new text be?' },
      { role: 'user', content: 'All-Star HVAC' },
    ],
    ...overrides,
  };
}

describe('deterministic copy follow-ups', () => {
  it('plans dual update_business_name + update_hero after both choice', () => {
    const plan = buildDeterministicPlan(contextWithDuplicate({}));
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps.map((s) => s.skill)).toEqual([
      'update_business_name',
      'update_hero',
    ]);
    expect(plan?.steps[0]?.params?.value).toBe('All-Star HVAC');
  });

  it('plans quoted replacement for unique businessName match', () => {
    const plan = buildDeterministicPlan(
      contextWithDuplicate({
        effectiveMessage: 'change "Only Biz" to "New Co"',
        ownerMessage: 'change "Only Biz" to "New Co"',
        conversationHistory: [],
        siteModel: {
          workspacePath: '/tmp',
          mode: 'gitlab',
          archetype: 'section-loop',
          siteConfigContent: `export const siteConfig = {
  "businessName": "Only Biz",
  "hero": { "headline": "Different", "subheadline": "Sub" },
  "sections": []
} as const;`,
        } as unknown as EditContext['siteModel'],
      })
    );
    expect(plan?.steps[0]?.skill).toBe('update_business_name');
    expect(plan?.steps[0]?.params?.value).toBe('New Co');
  });
});

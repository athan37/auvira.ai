import { describe, expect, it } from 'vitest';
import { buildPlanEditUserPrompt } from '@/lib/project-workspace/planner/planEditPrompt';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function minimalEditContext(
  overrides: Partial<EditContext> = {}
): EditContext {
  return {
    workspacePath: '/tmp/ws',
    mode: 'gitlab',
    ownerMessage: 'Lime green gradient',
    effectiveMessage: 'Lime green gradient',
    siteModel: {
      workspacePath: '/tmp/ws',
      mode: 'gitlab',
      archetype: 'section-loop',
      parsedConfig: { businessName: 'Test Co', contact: {}, sections: [] },
    } as unknown as EditContext['siteModel'],
    sectionCatalog: { sections: [], textBlock: '(empty)', numberedReplies: [] } as unknown as EditContext['sectionCatalog'],
    sections: [],
    target: { kind: 'site', confidence: 'medium', candidates: [], needsClarification: false },
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
    ...overrides,
  };
}

describe('buildPlanEditUserPrompt', () => {
  it('includes the last 8 conversation turns for the planner LLM', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn-${i}`,
    }));

    const prompt = buildPlanEditUserPrompt(
      minimalEditContext({ conversationHistory: history }),
      'Lime green gradient'
    );

    expect(prompt).toContain('CONVERSATION CONTEXT');
    expect(prompt).toContain('turn-2');
    expect(prompt).toContain('turn-9');
    expect(prompt).not.toContain('turn-0');
    expect(prompt).not.toContain('turn-1');
  });
});

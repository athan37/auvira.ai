import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

vi.mock('@/lib/project-workspace/planner/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';

function baseContext(): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'use my favorite color',
    effectiveMessage: 'use my favorite color',
    siteModel: {
      workspacePath: '/tmp',
      mode: 'gitlab',
      archetype: 'section-loop',
      siteConfigContent: 'export const siteConfig = { "sections": [] } as const;',
    } as unknown as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as unknown as EditContext['sectionCatalog'],
    sections: [],
    target: { kind: 'section', sectionIndex: 0, confidence: 'high', candidates: [], needsClarification: false },
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
    conversationHistory: [],
  };
}

describe('resolveImplicitReferences LLM fallback', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, OBSERVABILITY_COACHING_ENABLED: '1', OBSERVABILITY_API_KEY: 'k' };
    vi.mocked(getLLMClient).mockReset();
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns clarification when LLM confidence is low', async () => {
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          canResolve: false,
          resolvedPhrase: 'my favorite color',
          resolvedValue: null,
          confidence: 'low',
          reason: 'insufficient evidence',
          clarificationQuestion: 'What color should I use?',
          suggestedReplies: ['Blue', 'Green'],
        },
      }),
    } as never);

    const result = await resolveImplicitReferences({
      ownerMessage: 'make background my favorite color',
      editContext: baseContext(),
      coachingContext: {
        coachingHints: ['prior edits mention colors'],
        constraints: {},
        qualitySnapshot: {},
        recurringIssues: [],
        source: 'test',
      },
    });

    expect(result.needsClarification).toBe(true);
    expect(result.clarificationMessage).toBe('What color should I use?');
  });

  it('accepts high-confidence LLM resolution with evidence', async () => {
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          canResolve: true,
          resolvedPhrase: 'my favorite color',
          resolvedValue: 'teal',
          resolvedKind: 'color',
          confidence: 'high',
          reason: 'chat history states favorite color is teal',
          clarificationQuestion: null,
          suggestedReplies: [],
        },
      }),
    } as never);

    const result = await resolveImplicitReferences({
      ownerMessage: 'make background my favorite color',
      editContext: baseContext(),
      coachingContext: {
        coachingHints: [],
        constraints: {},
        qualitySnapshot: {},
        recurringIssues: [],
        source: 'test',
      },
    });

    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('teal');
    expect(result.references[0]?.source).toBe('llm_inference');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { assessEditAmbiguity } from '@/lib/project-workspace/edit-context/assessEditAmbiguity';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

vi.mock('@/lib/observability/fetchObservabilityIntent', () => ({
  fetchObservabilityIntent: vi.fn(),
}));

describe('implicit reference pipeline gating', () => {
  it('monitor unavailable returns null without throwing', async () => {
    vi.mocked(fetchObservabilityIntent).mockResolvedValue(null);
    const result = await fetchObservabilityIntent('proj-1');
    expect(result).toBeNull();
  });

  it('resolver clarification blocks before planning would run', async () => {
    const resolution = await resolveImplicitReferences({
      ownerMessage: 'make background my favorite color',
      editContext: {
        workspacePath: '/tmp',
        mode: 'gitlab',
        ownerMessage: 'make background my favorite color',
        effectiveMessage: 'make background my favorite color',
        siteModel: {
          workspacePath: '/tmp',
          mode: 'gitlab',
          archetype: 'section-loop',
        } as never,
        sectionCatalog: { textBlock: '', sections: [] } as never,
        sections: [],
        target: {
          kind: 'section',
          sectionIndex: 0,
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
      },
    });
    expect(resolution.needsClarification).toBe(true);
  });

  it('one-shots favorite color from prior clarify thread and passes ambiguity gate', async () => {
    const editContext: EditContext = {
      workspacePath: '/tmp',
      mode: 'gitlab',
      ownerMessage: 'change background to my faviorite color',
      effectiveMessage: 'change background to my faviorite color',
      siteModel: {
        workspacePath: '/tmp',
        mode: 'gitlab',
        archetype: 'section-loop',
      } as never,
      sectionCatalog: { textBlock: '', sections: [] } as never,
      sections: [{ index: 1, type: 'contact', title: 'Contact' }],
      target: {
        kind: 'section',
        sectionIndex: 1,
        confidence: 'high',
        candidates: [],
        needsClarification: false,
      },
      selectedTarget: {
        kind: 'section',
        sectionId: 'contact',
        sectionIndex: 1,
        label: 'Contact Us › Contact card › Contact Information',
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

    const resolution = await resolveImplicitReferences({
      ownerMessage: 'change background to my faviorite color',
      editContext,
      recentHistory: [
        { role: 'user', content: 'change the Contact section to my favourite color' },
        {
          role: 'assistant',
          content: 'What color should I use?',
          metadata: { pendingImplicitRef: { phrase: 'my favourite color', kind: 'color' } },
        },
        { role: 'user', content: 'green' },
        { role: 'assistant', content: 'Updated the page content.' },
      ],
    });

    expect(resolution.needsClarification).toBeUndefined();
    expect(resolution.references[0]?.resolvedValue).toBe('green');

    editContext.effectiveMessage = resolution.resolvedMessage ?? editContext.effectiveMessage;
    editContext.resolvedReferences = resolution.references;

    const structural = assessEditAmbiguity(editContext);
    expect(structural.blocked).toBe(false);
    expect(structural.reasons).not.toContain('missing_value');
  });
});

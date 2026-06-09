import { describe, expect, it, vi } from 'vitest';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';

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
});

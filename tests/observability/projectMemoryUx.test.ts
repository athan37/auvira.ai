import { describe, expect, it } from 'vitest';
import { enrichObservabilityMetadataForChat } from '@/lib/observability/formatEditContextSummary';
import { getProjectMemoryView, getTipsView } from '@/lib/observability/formatCoachingSummary';

const resolvedRef = {
  phrase: 'my favorite color',
  resolvedValue: 'blue',
  resolvedKind: 'color' as const,
  source: 'project_intent' as const,
  confidence: 'high' as const,
  reason: 'keyword',
};

describe('Project Memory UX matrix', () => {
  it('success + resolved refs → project memory, no tips', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'success',
      resolvedReferences: [resolvedRef],
    });
    expect(getProjectMemoryView('success', meta)).not.toBeNull();
    expect(getTipsView('success', [], meta)).toBeNull();
    expect(meta?.appliedProjectMemory).toHaveLength(1);
    expect(meta?.projectVocabulary).toBeUndefined();
  });

  it('success + no refs → neither surface', () => {
    const meta = enrichObservabilityMetadataForChat(
      { coachingApplied: true, coachingHints: ['Hint'] },
      { outcome: 'success', resolvedReferences: [] }
    );
    expect(getProjectMemoryView('success', meta)).toBeNull();
    expect(getTipsView('success', [], meta)).toBeNull();
  });

  it('clarification + guidance → tips only', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'clarification',
      resolvedReferences: [resolvedRef],
    });
    expect(getProjectMemoryView('clarification', meta)).toBeNull();
    expect(meta?.appliedProjectMemory).toBeUndefined();
    const tips = getTipsView('clarification', ['Pin a section from the preview.'], meta);
    expect(tips?.hints).toEqual(['Pin a section from the preview.']);
  });

  it('failure + coaching → tips only', () => {
    const meta = enrichObservabilityMetadataForChat(
      {
        coachingApplied: true,
        coachingHintCount: 1,
        coachingHints: ['Verify build gate.'],
      },
      { outcome: 'failure' }
    );
    expect(getProjectMemoryView('failure', meta)).toBeNull();
    expect(getTipsView('failure', [], meta)?.hints).toEqual(['Verify build gate.']);
  });

  it('success with legacy resolvedReferences still renders memory view', () => {
    const legacy = {
      resolvedReferences: [
        { phrase: 'my favorite color', resolvedValue: 'blue', source: 'Project Memory' },
      ],
    };
    const memory = getProjectMemoryView('success', legacy);
    expect(memory?.lines[0]).toContain('Used project context');
  });
});

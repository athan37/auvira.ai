import { describe, expect, it } from 'vitest';
import { enrichObservabilityMetadataForChat } from '@/lib/observability/formatEditContextSummary';
import { getIntentFeedView, getMonitorContextView, getProjectMemoryView, getProjectVocabularyView, getTipsView } from '@/lib/observability/formatCoachingSummary';

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
  });

  it('success + project intent → intent feed visible in chat metadata', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'success',
      projectIntent: {
        sentence: 'Change hero.primaryCta to "Book Now".',
      },
    });
    expect(meta?.intentFeed?.sentence).toContain('Book Now');
    expect(getIntentFeedView(meta)?.panelLines[0]).toContain('Book Now');
  });

  it('every edit with monitor payloads → /context and /intent feeds', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'clarification',
      projectIntent: null,
      coachingContext: {
        coachingHints: ['Honor pinned target.'],
        constraints: { honor_target_section: true },
        qualitySnapshot: { latest_grade: 'C' },
        recurringIssues: ['EDIT_INTENT_KEYWORD_MISSING'],
        source: 'turn_ledger',
      },
    });
    expect(getMonitorContextView(meta)?.panelLines[0]).toMatch(/^Source:/);
    expect(getIntentFeedView(meta)).toBeNull();
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

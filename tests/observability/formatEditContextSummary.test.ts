import { describe, expect, it } from 'vitest';
import {
  buildAppliedProjectMemoryForChat,
  buildProjectVocabularyForChat,
  buildResolvedReferencesForChat,
  enrichObservabilityMetadataForChat,
  formatUsedProjectContextLines,
} from '@/lib/observability/formatEditContextSummary';
import { getProjectMemoryView, getTipsView } from '@/lib/observability/formatCoachingSummary';

describe('formatEditContextSummary', () => {
  it('skips vocabulary when turn_count is zero', () => {
    expect(
      buildProjectVocabularyForChat({
        keywords: ['blue'],
        intents: [],
        turn_count: 0,
        updated_at: null,
      })
    ).toBeUndefined();
  });

  it('builds capped vocabulary snapshot', () => {
    const vocab = buildProjectVocabularyForChat({
      keywords: Array.from({ length: 12 }, (_, i) => `kw${i}`),
      intents: [{ label: 'color edit', count: 2 }],
      turn_count: 3,
      updated_at: null,
    });
    expect(vocab?.keywords).toHaveLength(10);
    expect(vocab?.intents).toHaveLength(1);
  });

  it('builds resolved references with values only', () => {
    const rows = buildResolvedReferencesForChat([
      {
        phrase: 'my favorite color',
        resolvedValue: 'blue',
        resolvedKind: 'color',
        source: 'project_intent',
        confidence: 'high',
        reason: 'keyword',
      },
      {
        phrase: 'usual CTA',
        resolvedKind: 'cta',
        source: 'chat_history',
        confidence: 'low',
        reason: 'missing',
      },
    ]);
    expect(rows).toEqual([
      {
        phrase: 'my favorite color',
        resolvedValue: 'blue',
        source: 'Project Memory',
      },
    ]);
  });

  it('stores applied project memory only on success', () => {
    const refs = [
      {
        phrase: 'my favorite color',
        resolvedValue: 'blue',
        resolvedKind: 'color' as const,
        source: 'project_intent' as const,
        confidence: 'high' as const,
        reason: 'keyword',
      },
    ];

    expect(buildAppliedProjectMemoryForChat(refs, 'success')).toHaveLength(1);
    expect(buildAppliedProjectMemoryForChat(refs, 'clarification')).toBeUndefined();
    expect(buildAppliedProjectMemoryForChat(refs, 'failure')).toBeUndefined();
  });

  it('does not attach vocabulary or raw refs to chat metadata', () => {
    const meta = enrichObservabilityMetadataForChat(
      { coachingApplied: false, experimentVariant: 'control' },
      {
        outcome: 'success',
        resolvedReferences: [
          {
            phrase: 'my favorite color',
            resolvedValue: 'blue',
            resolvedKind: 'color',
            source: 'project_intent',
            confidence: 'high',
            reason: 'keyword',
          },
        ],
      }
    );
    expect(meta?.projectVocabulary).toBeUndefined();
    expect(meta?.resolvedReferences).toBeUndefined();
    expect(meta?.appliedProjectMemory).toHaveLength(1);
  });

  it('shows applied memory in project memory view, not tips', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'success',
      resolvedReferences: [
        {
          phrase: 'my favorite color',
          resolvedValue: 'blue',
          resolvedKind: 'color',
          source: 'project_intent',
          confidence: 'high',
          reason: 'keyword',
        },
      ],
    });
    const memory = getProjectMemoryView('success', meta);
    expect(memory?.lines[0]).toContain('Used project context');
    expect(memory?.lines[0]).toContain('my favorite color');
    expect(getTipsView('success', [], meta)).toBeNull();
  });

  it('formats inline used project context lines', () => {
    expect(
      formatUsedProjectContextLines([
        { phrase: 'my favorite color', resolvedValue: 'blue', source: 'Project Memory' },
      ])
    ).toEqual(['Used project context: "my favorite color" → "blue"']);
  });
});

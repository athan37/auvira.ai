import { describe, expect, it } from 'vitest';
import {
  buildProjectVocabularyForChat,
  buildResolvedReferencesForChat,
  enrichObservabilityMetadataForChat,
} from '@/lib/observability/formatEditContextSummary';
import { getMessageHintsView } from '@/lib/observability/formatCoachingSummary';

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
        source: 'project vocabulary',
      },
    ]);
  });

  it('shows vocabulary and resolved refs in hints panel view', () => {
    const meta = enrichObservabilityMetadataForChat(
      { coachingApplied: false, experimentVariant: 'control' },
      {
        projectIntent: {
          keywords: ['blue', 'cta'],
          intents: [{ label: 'color edit', count: 2 }],
          turn_count: 2,
          updated_at: null,
        },
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
    const view = getMessageHintsView([], meta);
    expect(view?.projectVocabulary?.[0]).toContain('Recurring topics');
    expect(view?.resolvedReferences?.[0]).toContain('my favorite color');
    expect(view?.label).toMatch(/hint/);
  });
});

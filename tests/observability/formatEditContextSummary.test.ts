import { describe, expect, it } from 'vitest';
import {
  buildAppliedProjectMemoryForChat,
  buildIntentFeedForChat,
  buildMonitorContextForChat,
  buildProjectVocabularyForChat,
  buildResolvedReferencesForChat,
  enrichObservabilityMetadataForChat,
  formatMonitorContextPanelLines,
  formatIntentFeedPanelLines,
  formatUsedProjectContextLines,
} from '@/lib/observability/formatEditContextSummary';
import { getIntentFeedView } from '@/lib/observability/formatCoachingSummary';

describe('formatEditContextSummary', () => {
  it('skips intent feed when sentence is empty', () => {
    expect(buildProjectVocabularyForChat({ sentence: '  ' })).toBeUndefined();
  });

  it('builds intent sentence snapshot', () => {
    const feed = buildProjectVocabularyForChat({
      sentence: 'Change sections[2].presentation.cardClass to green.',
    });
    expect(feed?.sentence).toContain('cardClass');
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

  it('attaches intent feed only when project intent is provided', () => {
    const meta = enrichObservabilityMetadataForChat(
      { coachingApplied: false, experimentVariant: 'control' },
      {
        outcome: 'success',
        projectIntent: {
          sentence:
            "Change the contact background (sections[1].presentation.backgroundClass) to blue, the owner's favorite color.",
        },
        coachingContext: {
          coachingHints: ['Keep palette consistent.'],
          constraints: { require_verify_pass: true },
          qualitySnapshot: { latestGrade: 'B', latestOverallScore: 0.72 },
          recurringIssues: ['WRONG_SECTION_TARGET'],
          missingKeywords: [],
          source: 'phoenix_traces',
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
    expect(meta?.intentFeed?.sentence).toContain('blue');
    expect(meta?.monitorContext).toBeUndefined();
    expect(meta?.appliedProjectMemory).toBeUndefined();
    expect(getIntentFeedView(meta)?.label).toMatch(/^\/intent/);
  });

  it('formats empty intent feed panel', () => {
    expect(formatIntentFeedPanelLines(undefined)).toEqual(['Intent: (none)']);
  });

  it('formats monitor context feed panel lines', () => {
    const context = buildMonitorContextForChat({
      coachingHints: ['Hint one'],
      constraints: { require_verify_pass: true },
      qualitySnapshot: { latestGrade: 'B', latestOverallScore: 0.7 },
      recurringIssues: ['ISSUE_A'],
      missingKeywords: [],
      source: 'turn_ledger',
    });
    expect(formatMonitorContextPanelLines(context)).toEqual(
      expect.arrayContaining([
        'Source: turn_ledger',
        'Coaching: Hint one',
        'Recurring issues: ISSUE_A',
        'Constraints: require_verify_pass',
        'Quality: B · score 0.70',
      ])
    );
  });

  it('formats inline used project context lines', () => {
    expect(
      formatUsedProjectContextLines([
        { phrase: 'my favorite color', resolvedValue: 'blue', source: 'Project Memory' },
      ])
    ).toEqual(['Used project context: "my favorite color" → "blue"']);
  });
});

import { describe, expect, it } from 'vitest';
import { parseCoachingContext } from '@/lib/observability/fetchCoachingContext';

describe('parseCoachingContext', () => {
  it('parses missing keywords and quality snapshot fields', () => {
    const parsed = parseCoachingContext({
      coaching_hints: ['Be specific about section names'],
      recurring_issues: ['ambiguous section'],
      missing_keywords: ['favorite', 'color'],
      trace_count: 12,
      source: 'turn_ledger',
      quality_snapshot: {
        trend: 'improving',
        latest_overall_score: 0.82,
        latest_grade: 'B',
      },
      constraints: { max_latency_ms: 8000 },
      hint_policy: { max_hints: 3 },
    });

    expect(parsed.coachingHints).toEqual(['Be specific about section names']);
    expect(parsed.recurringIssues).toEqual(['ambiguous section']);
    expect(parsed.missingKeywords).toEqual(['favorite', 'color']);
    expect(parsed.traceCount).toBe(12);
    expect(parsed.source).toBe('turn_ledger');
    expect(parsed.qualitySnapshot).toMatchObject({
      trend: 'improving',
      latestOverallScore: 0.82,
      latestGrade: 'B',
    });
    expect(parsed.hintPolicy).toEqual({ max_hints: 3 });
  });

  it('defaults missing arrays and unknown source', () => {
    const parsed = parseCoachingContext({});
    expect(parsed.coachingHints).toEqual([]);
    expect(parsed.missingKeywords).toEqual([]);
    expect(parsed.source).toBe('unknown');
  });
});

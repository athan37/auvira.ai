import { describe, expect, it } from 'vitest';
import { buildSessionSummaryCards } from '@/lib/observability/sessionSummaryCards';

describe('buildSessionSummaryCards', () => {
  it('maps dashboard cards to stat rows', () => {
    const cards = buildSessionSummaryCards({
      turnCount: 5,
      sessionGrade: 'B',
      sessionScore: 0.84,
      latestGrade: 'A',
      latestScore: 0.91,
      trend: 'improving',
      topIssueLabel: 'ambiguous section',
      outcomeSuccessRate: 0.8,
      verifyPassRate: 0.75,
      buildGatePassRate: 0.7,
      avgLatencyMs: 4200,
    });

    expect(cards.find((c) => c.label === 'Turn count')?.value).toBe('5');
    expect(cards.find((c) => c.label === 'Top issue')?.value).toBe('ambiguous section');
    expect(cards.find((c) => c.label === 'Outcome success')?.value).toBe('80%');
    expect(cards.find((c) => c.label === 'Avg latency')?.value).toBe('4200 ms');
  });
});

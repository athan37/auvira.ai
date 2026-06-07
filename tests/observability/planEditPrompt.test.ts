import { describe, expect, it } from 'vitest';
import { buildPlanEditSystemPrompt } from '@/lib/project-workspace/planner/planEditPrompt';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

describe('buildPlanEditSystemPrompt coaching block', () => {
  const coaching: ObservabilityCoachingContext = {
    coachingHints: ['Prior turn failed build gate — verify TypeScript compiles.'],
    constraints: { require_build_gate_pass: true },
    qualitySnapshot: { latest_grade: 'B' },
    recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
    source: 'phoenix_traces',
  };

  it('returns base prompt without coaching', () => {
    const prompt = buildPlanEditSystemPrompt();
    expect(prompt).toContain('Website Edit Agent planner');
    expect(prompt).not.toContain('Coaching from prior edits');
  });

  it('appends coaching block when context has hints', () => {
    const prompt = buildPlanEditSystemPrompt(coaching);
    expect(prompt).toContain('## Coaching from prior edits');
    expect(prompt).toContain('Prior turn failed build gate');
    expect(prompt).toContain('require_build_gate_pass');
  });

  it('skips coaching block when hints array is empty', () => {
    const prompt = buildPlanEditSystemPrompt({ ...coaching, coachingHints: [] });
    expect(prompt).not.toContain('Coaching from prior edits');
  });
});

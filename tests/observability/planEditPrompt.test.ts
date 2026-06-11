import { describe, expect, it } from 'vitest';
import {
  buildPlanEditSystemPrompt,
  formatProjectIntentBlock,
  formatResolvedReferencesBlock,
} from '@/lib/project-workspace/planner/planEditPrompt';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';

describe('buildPlanEditSystemPrompt coaching block', () => {
  const coaching: ObservabilityCoachingContext = {
    coachingHints: ['Prior turn failed build gate — verify TypeScript compiles.'],
    constraints: { require_build_gate_pass: true },
    qualitySnapshot: { latestGrade: 'B' },
    recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
    missingKeywords: [],
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

  it('omits intent block when sentence is empty', () => {
    const block = formatProjectIntentBlock({ sentence: '  ' });
    expect(block).toBeNull();
  });

  it('includes Monitor intent sentence in planner prompt', () => {
    const block = formatProjectIntentBlock({
      sentence: 'Change sections[2].presentation.cardClass to green.',
    });
    expect(block).toContain('## Project intent');
    expect(block).toContain('sections[2].presentation.cardClass');
  });

  it('omits resolved block without resolvedValue', () => {
    const refs: ImplicitReferenceRecord[] = [
      {
        phrase: 'my favorite color',
        resolvedKind: 'color',
        source: 'chat_history',
        confidence: 'low',
        reason: 'unresolved',
      },
    ];
    expect(formatResolvedReferencesBlock(refs)).toBeNull();
  });

  it('orders intent before coaching and includes resolved references', () => {
    const refs: ImplicitReferenceRecord[] = [
      {
        phrase: 'usual CTA',
        resolvedValue: 'Book Now',
        resolvedKind: 'cta',
        source: 'chat_history',
        confidence: 'high',
        reason: 'history',
      },
    ];
    const prompt = buildPlanEditSystemPrompt(
      coaching,
      { sentence: 'Change hero.primaryCta to "Book Now".' },
      refs
    );
    const intentIdx = prompt.indexOf('## Project intent');
    const resolvedIdx = prompt.indexOf('## Resolved user references');
    const coachingIdx = prompt.indexOf('## Coaching from prior edits');
    expect(intentIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(intentIdx);
    expect(coachingIdx).toBeGreaterThan(resolvedIdx);
    expect(prompt).toContain('"Book Now"');
  });

  it('coaching disabled means no intent injection via null args', () => {
    const prompt = buildPlanEditSystemPrompt(null, null, null);
    expect(prompt).not.toContain('Project intent');
    expect(prompt).not.toContain('Resolved user references');
  });
});

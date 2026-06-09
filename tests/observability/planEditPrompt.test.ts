import { describe, expect, it } from 'vitest';
import {
  buildPlanEditSystemPrompt,
  formatProjectVocabularyBlock,
  formatResolvedReferencesBlock,
} from '@/lib/project-workspace/planner/planEditPrompt';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';

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

  it('omits vocabulary when turn_count is zero', () => {
    const block = formatProjectVocabularyBlock({
      keywords: ['blue'],
      intents: [{ label: 'color', count: 1 }],
      turn_count: 0,
      updated_at: null,
    });
    expect(block).toBeNull();
  });

  it('caps vocabulary keywords and intents', () => {
    const block = formatProjectVocabularyBlock({
      keywords: Array.from({ length: 15 }, (_, i) => `kw${i}`),
      intents: Array.from({ length: 8 }, (_, i) => ({ label: `intent${i}`, count: i })),
      turn_count: 3,
      updated_at: null,
    });
    expect(block).toContain('kw0');
    expect(block).not.toContain('kw14');
    expect(block).toContain('intent4');
    expect(block).not.toContain('intent7');
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

  it('orders vocabulary before coaching and includes resolved references', () => {
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
    const prompt = buildPlanEditSystemPrompt(coaching, {
      keywords: ['cta'],
      intents: [{ label: 'button', count: 2 }],
      turn_count: 2,
      updated_at: null,
    }, refs);
    const vocabIdx = prompt.indexOf('## Project vocabulary');
    const resolvedIdx = prompt.indexOf('## Resolved user references');
    const coachingIdx = prompt.indexOf('## Coaching from prior edits');
    expect(vocabIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(vocabIdx);
    expect(coachingIdx).toBeGreaterThan(resolvedIdx);
    expect(prompt).toContain('"Book Now"');
  });

  it('coaching disabled means no vocabulary injection via buildPlanEditSystemPrompt args', () => {
    const prompt = buildPlanEditSystemPrompt(null, null, null);
    expect(prompt).not.toContain('Project vocabulary');
    expect(prompt).not.toContain('Resolved user references');
  });
});

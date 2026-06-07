import { describe, expect, it } from 'vitest';
import {
  formatCoachingSummary,
  getCoachingSummaryView,
  getGuidanceTipsView,
  getMessageHintsView,
} from '@/lib/observability/formatCoachingSummary';

describe('formatCoachingSummary', () => {
  it('shows applied label with hint count on success turns', () => {
    expect(
      formatCoachingSummary({
        coachingApplied: true,
        coachingHintCount: 2,
        experimentVariant: 'coached',
        coachingHints: ['Keep hero copy concise.', 'Verify build gate before replying.'],
      })
    ).toBe('2 hints');
  });

  it('shows singular hint label', () => {
    expect(
      formatCoachingSummary({
        coachingApplied: true,
        coachingHintCount: 1,
        experimentVariant: 'coached',
        coachingHints: ['Prior turn failed build gate.'],
      })
    ).toBe('1 hint');
  });

  it('notes hints available but not applied when coaching disabled', () => {
    expect(
      formatCoachingSummary({
        coachingApplied: false,
        coachingHintCount: 3,
        experimentVariant: 'control',
        coachingHints: ['Hint A', 'Hint B', 'Hint C'],
      })
    ).toBe('3 hints available (not applied)');
  });

  it('merges guidance hints with coaching hints', () => {
    const view = getMessageHintsView(
      ['Pin a section from the preview.'],
      {
        coachingApplied: true,
        coachingHintCount: 1,
        coachingHints: ['Honor selectedTarget.'],
      }
    );
    expect(view?.label).toBe('2 hints');
    expect(view?.hints).toEqual(['Pin a section from the preview.']);
    expect(view?.monitorHints).toEqual(['Honor selectedTarget.']);
  });

  it('shows guidance hints on clarification without coaching', () => {
    const view = getGuidanceTipsView('clarification', [
      'Pin a section from the preview.',
      'Include the exact new value.',
    ]);
    expect(view?.label).toBe('2 hints');
    expect(view?.hints).toHaveLength(2);
  });

  it('exposes hint text for click panels', () => {
    const view = getCoachingSummaryView({
      coachingApplied: true,
      coachingHintCount: 2,
      coachingHints: ['Hint A', 'Hint B'],
    });
    expect(view?.label).toBe('2 hints');
    expect(view?.hints).toEqual(['Hint A', 'Hint B']);
  });
});

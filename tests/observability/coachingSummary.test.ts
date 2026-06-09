import { describe, expect, it } from 'vitest';
import {
  formatCoachingSummary,
  getCoachingSummaryView,
  getGuidanceTipsView,
  getMessageHintsView,
  getProjectMemoryView,
  getTipsView,
} from '@/lib/observability/formatCoachingSummary';

describe('formatCoachingSummary', () => {
  it('returns null on success turns even when coaching was applied', () => {
    expect(
      formatCoachingSummary(
        {
          coachingApplied: true,
          coachingHintCount: 2,
          experimentVariant: 'coached',
          coachingHints: ['Keep hero copy concise.', 'Verify build gate before replying.'],
        },
        { outcome: 'success' }
      )
    ).toBeNull();
  });

  it('shows tips label on clarification turns with coaching', () => {
    expect(
      formatCoachingSummary(
        {
          coachingApplied: true,
          coachingHintCount: 1,
          experimentVariant: 'coached',
          coachingHints: ['Prior turn failed build gate.'],
        },
        { outcome: 'clarification' }
      )
    ).toBe('1 tip');
  });

  it('notes tips available but not applied when coaching disabled on failure', () => {
    expect(
      formatCoachingSummary(
        {
          coachingApplied: false,
          coachingHintCount: 3,
          experimentVariant: 'control',
          coachingHints: ['Hint A', 'Hint B', 'Hint C'],
        },
        { outcome: 'failure' }
      )
    ).toBe('3 tips available (not applied)');
  });

  it('merges guidance hints with coaching hints on clarification', () => {
    const view = getTipsView(
      'clarification',
      ['Pin a section from the preview.'],
      {
        coachingApplied: true,
        coachingHintCount: 1,
        coachingHints: ['Honor selectedTarget.'],
      }
    );
    expect(view?.label).toBe('2 tips');
    expect(view?.hints).toEqual(['Pin a section from the preview.']);
    expect(view?.monitorHints).toEqual(['Honor selectedTarget.']);
  });

  it('shows guidance hints on clarification without coaching', () => {
    const view = getGuidanceTipsView('clarification', [
      'Pin a section from the preview.',
      'Include the exact new value.',
    ]);
    expect(view?.label).toBe('2 tips');
    expect(view?.hints).toHaveLength(2);
  });

  it('exposes tip text for click panels on failure', () => {
    const view = getCoachingSummaryView(
      {
        coachingApplied: true,
        coachingHintCount: 2,
        coachingHints: ['Hint A', 'Hint B'],
      },
      { outcome: 'failure' }
    );
    expect(view?.label).toBe('2 tips');
    expect(view?.hints).toEqual(['Hint A', 'Hint B']);
  });

  it('getProjectMemoryView returns null on success without applied memory', () => {
    expect(
      getProjectMemoryView('success', {
        coachingApplied: true,
        coachingHintCount: 2,
        coachingHints: ['Hint A'],
      })
    ).toBeNull();
  });

  it('getTipsView returns null on success', () => {
    expect(
      getTipsView('success', ['Pin a section.'], {
        coachingApplied: true,
        coachingHints: ['Honor target.'],
      })
    ).toBeNull();
  });

  it('getMessageHintsView delegates to getTipsView', () => {
    const view = getMessageHintsView(
      ['Pin a section from the preview.'],
      { coachingApplied: true, coachingHints: ['Honor target.'] },
      'clarification'
    );
    expect(view?.label).toBe('2 tips');
  });
});

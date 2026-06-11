import { describe, expect, it } from 'vitest';
import {
  parseMonitorDashboardResponse,
  parseMonitorDashboardTurn,
} from '@/lib/observability/parseMonitorDashboard';

describe('parseMonitorDashboardTurn', () => {
  it('maps monitor turn rows', () => {
    const row = parseMonitorDashboardTurn({
      turn_id: 't-1',
      turn_index: 3,
      created_at: '2026-06-09T12:00:00Z',
      user_message: 'change background to my favorite color',
      trace_id: 'trace-abc',
      grade: 'B',
      overall_score: 0.82,
      outcome: 'success',
    });

    expect(row).toEqual({
      turnId: 't-1',
      turnIndex: 3,
      traceId: 'trace-abc',
      userMessage: 'change background to my favorite color',
      grade: 'B',
      overallScore: 0.82,
      outcome: 'success',
      issueCodes: undefined,
      latencyMs: undefined,
      createdAt: '2026-06-09T12:00:00Z',
      verifyPass: null,
      buildGatePass: null,
      changedFileCount: undefined,
    });
  });

  it('returns null when required fields are missing', () => {
    expect(parseMonitorDashboardTurn({ turn_id: 't-1' })).toBeNull();
  });
});

describe('parseMonitorDashboardResponse', () => {
  it('parses dashboard cards, turns, and hints', () => {
    const view = parseMonitorDashboardResponse({
      dashboard: {
        cards: {
          session_grade: 'B',
          session_score: 0.84,
          turn_count: 2,
          latest_grade: 'A',
          latest_score: 0.91,
          top_issue_label: 'ambiguous section',
        },
        turns: [
          {
            turn_id: 't-1',
            turn_index: 0,
            created_at: '2026-06-09T12:00:00Z',
            user_message: 'make hero red',
            grade: 'A',
            outcome: 'success',
          },
        ],
        coaching_hints: ['Be specific about section names'],
        recurring_issues: ['ambiguous section'],
      },
    });

    expect(view?.cards).toMatchObject({
      sessionGrade: 'B',
      sessionScore: 0.84,
      turnCount: 2,
      latestGrade: 'A',
      latestScore: 0.91,
      topIssueLabel: 'ambiguous section',
    });
    expect(view?.turns).toHaveLength(1);
    expect(view?.coachingHints).toEqual(['Be specific about section names']);
    expect(view?.recurringIssues).toEqual(['ambiguous section']);
  });

  it('returns null when dashboard is missing', () => {
    expect(parseMonitorDashboardResponse(null)).toBeNull();
    expect(parseMonitorDashboardResponse({})).toBeNull();
  });

  it('parses executive, learning, charts, and improvement brief', () => {
    const view = parseMonitorDashboardResponse({
      dashboard: {
        cards: { turn_count: 3, session_grade: 'B' },
        turns: [],
        executive_kpis: {
          reliability_score: 78,
          reliability_grade: 'B',
          reliability_strong: true,
          operations: { turns_to_first_success: 2, session_resolved: true },
        },
        learning_metrics: {
          proof_summary: { quality_improving: true },
          coaching_effectiveness: { coaching_lift_score: 0.12 },
        },
        charts: {
          score_series: [{ turn_index: 0, overall_score: 0.7, grade: 'C' }],
          issue_pareto: [{ label: 'Ambiguous section', count: 2 }],
          gate_funnel: { total_turns: 3, outcome_success: 2, verify_pass: 2, build_gate_pass: 1 },
        },
        improvement_brief:
          '1. Overall performance\nSession is improving.\n\n2. Main failure patterns\nBuild gate misses.',
      },
    });

    expect(view?.executiveKpis?.reliabilityScore).toBe(78);
    expect(view?.learningMetrics?.proofSummary?.quality_improving).toBe(true);
    expect(view?.charts?.scoreSeries).toHaveLength(1);
    expect(view?.charts?.issuePareto[0]?.label).toBe('Ambiguous section');
    expect(view?.improvementBriefSections).toHaveLength(2);
  });

  it('returns null executive section when reliability_score is null', () => {
    const view = parseMonitorDashboardResponse({
      dashboard: { executive_kpis: { reliability_score: null }, turns: [], cards: {} },
    });
    expect(view?.executiveKpis?.reliabilityScore).toBeNull();
  });
});

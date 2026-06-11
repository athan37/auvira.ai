import type { MonitorDashboardCards } from './parseMonitorDashboard';

function formatRate(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value <= 1 ? value * 100 : value)}%`;
}

function formatScore(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

/** Build Group 1 stat card rows from dashboard.cards. */
export function buildSessionSummaryCards(
  cards: MonitorDashboardCards | null | undefined
): Array<{ label: string; value: string }> {
  if (!cards) return [];

  return [
    { label: 'Turn count', value: String(cards.turnCount ?? 0) },
    { label: 'Session grade', value: cards.sessionGrade ?? '—' },
    {
      label: 'Session score',
      value: cards.sessionScore != null ? formatRate(cards.sessionScore) : '—',
    },
    { label: 'Latest grade', value: cards.latestGrade ?? '—' },
    {
      label: 'Latest score',
      value: cards.latestScore != null ? formatScore(cards.latestScore) : '—',
    },
    { label: 'Trend', value: cards.trend ?? '—' },
    { label: 'Top issue', value: cards.topIssueLabel ?? '—' },
    { label: 'Outcome success', value: formatRate(cards.outcomeSuccessRate) },
    { label: 'Verify pass', value: formatRate(cards.verifyPassRate) },
    { label: 'Build gate pass', value: formatRate(cards.buildGatePassRate) },
    {
      label: 'Avg latency',
      value:
        cards.avgLatencyMs != null ? `${Math.round(cards.avgLatencyMs)} ms` : '—',
    },
  ];
}

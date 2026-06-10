/** Parsed Site Monitor GET .../conversations/{id}/dashboard payload. */

export interface MonitorDashboardCards {
  sessionGrade?: string;
  sessionScore?: number;
  turnCount?: number;
  trend?: string;
  latestGrade?: string;
  latestScore?: number;
  topIssue?: string;
  topIssueLabel?: string;
}

export interface MonitorDashboardTurnRow {
  turnId: string;
  turnIndex: number;
  traceId?: string;
  userMessage: string;
  grade?: string;
  overallScore?: number;
  outcome?: string;
  issueCodes?: string[];
  latencyMs?: number;
  createdAt: string;
  verifyPass?: boolean | null;
  buildGatePass?: boolean | null;
  changedFileCount?: number;
}

export interface MonitorDashboardView {
  cards: MonitorDashboardCards;
  turns: MonitorDashboardTurnRow[];
  coachingHints: string[];
  recurringIssues: string[];
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Map Monitor dashboard turn rows into a stable UI shape. */
export function parseMonitorDashboardTurn(
  raw: Record<string, unknown>
): MonitorDashboardTurnRow | null {
  const turnId = readString(raw.turn_id);
  const turnIndex = readNumber(raw.turn_index);
  const createdAt = readString(raw.created_at);
  const userMessage = readString(raw.user_message);
  if (!turnId || turnIndex == null || !createdAt || !userMessage) return null;

  return {
    turnId,
    turnIndex,
    traceId: readString(raw.trace_id),
    userMessage,
    grade: readString(raw.grade),
    overallScore: readNumber(raw.overall_score),
    outcome: readString(raw.outcome),
    issueCodes: Array.isArray(raw.issue_codes)
      ? raw.issue_codes.filter((code): code is string => typeof code === 'string')
      : undefined,
    latencyMs: readNumber(raw.latency_ms),
    createdAt,
    verifyPass: typeof raw.verify_pass === 'boolean' ? raw.verify_pass : null,
    buildGatePass: typeof raw.build_gate_pass === 'boolean' ? raw.build_gate_pass : null,
    changedFileCount: readNumber(raw.changed_file_count),
  };
}

/** Parse Site Monitor dashboard API response (non-throwing). */
export function parseMonitorDashboardResponse(
  raw: Record<string, unknown> | null | undefined
): MonitorDashboardView | null {
  const dashboard = raw?.dashboard;
  if (!dashboard || typeof dashboard !== 'object') return null;

  const cardsRaw = (dashboard as Record<string, unknown>).cards;
  const cardsObj =
    cardsRaw && typeof cardsRaw === 'object' ? (cardsRaw as Record<string, unknown>) : {};

  const turnsRaw = (dashboard as Record<string, unknown>).turns;
  const turns = Array.isArray(turnsRaw)
    ? turnsRaw
        .map((row) =>
          row && typeof row === 'object'
            ? parseMonitorDashboardTurn(row as Record<string, unknown>)
            : null
        )
        .filter((row): row is MonitorDashboardTurnRow => row != null)
    : [];

  const coachingHints = Array.isArray((dashboard as Record<string, unknown>).coaching_hints)
    ? ((dashboard as Record<string, unknown>).coaching_hints as unknown[]).filter(
        (hint): hint is string => typeof hint === 'string' && hint.trim().length > 0
      )
    : [];

  const recurringIssues = Array.isArray((dashboard as Record<string, unknown>).recurring_issues)
    ? ((dashboard as Record<string, unknown>).recurring_issues as unknown[]).filter(
        (issue): issue is string => typeof issue === 'string' && issue.trim().length > 0
      )
    : [];

  return {
    cards: {
      sessionGrade: readString(cardsObj.session_grade),
      sessionScore: readNumber(cardsObj.session_score),
      turnCount: readNumber(cardsObj.turn_count),
      trend: readString(cardsObj.trend),
      latestGrade: readString(cardsObj.latest_grade),
      latestScore: readNumber(cardsObj.latest_score),
      topIssue: readString(cardsObj.top_issue),
      topIssueLabel: readString(cardsObj.top_issue_label),
    },
    turns,
    coachingHints,
    recurringIssues,
  };
}

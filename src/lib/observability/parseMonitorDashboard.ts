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
  outcomeSuccessRate?: number;
  verifyPassRate?: number;
  buildGatePassRate?: number;
  avgLatencyMs?: number;
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
  issueLabels?: string[];
  latencyMs?: number;
  createdAt: string;
  verifyPass?: boolean | null;
  buildGatePass?: boolean | null;
  changedFileCount?: number;
}

export interface MonitorReliabilityComponents {
  success?: number;
  verify?: number;
  build?: number;
  recovery?: number;
}

export interface MonitorExecutiveOperations {
  turnsToFirstSuccess?: number;
  meanRecoveryTurns?: number;
  stabilityScore?: number;
  stableSession?: boolean;
  failureBlastRadius?: number;
  agentUptime?: number;
  sessionResolved?: boolean;
}

export interface MonitorExecutiveKpis {
  reliabilityScore?: number | null;
  reliabilityGrade?: string;
  reliabilityStrong?: boolean;
  reliabilityComponents?: MonitorReliabilityComponents;
  operations?: MonitorExecutiveOperations;
}

export interface MonitorLearningMetrics {
  proofSummary?: Record<string, boolean>;
  coachingEffectiveness?: Record<string, number>;
  learningVelocitySlope?: number;
  learningVelocityImproving?: boolean;
  timeToCompetencyTurnIndex?: number;
  issueDecay?: {
    firstHalfIssueCount?: number;
    secondHalfIssueCount?: number;
    issueDecayDelta?: number;
  };
  recovery?: {
    recoveryRate?: number;
    recoverySuccessCount?: number;
    recoveryEligibleTurns?: number;
  };
  coachingAdoption?: {
    coachingAdoptionRate?: number;
    coachedTurnCount?: number;
    avgCoachingHintCount?: number;
  };
}

export interface MonitorScoreSeriesPoint {
  turnIndex: number;
  overallScore?: number;
  grade?: string;
}

export interface MonitorIssueParetoRow {
  label: string;
  count: number;
}

export interface MonitorGateFunnel {
  totalTurns?: number;
  outcomeSuccess?: number;
  verifyPass?: number;
  buildGatePass?: number;
}

export interface MonitorChartsView {
  scoreSeries: MonitorScoreSeriesPoint[];
  issuePareto: MonitorIssueParetoRow[];
  gateFunnel?: MonitorGateFunnel;
  experimentBreakdown: Record<string, number>;
  latency?: {
    avg?: number;
    min?: number;
    max?: number;
    p50?: number;
  };
  latencyDeltaFirstToLastMs?: number;
}

export interface MonitorImprovementBriefSection {
  title: string;
  body: string;
}

export interface MonitorDashboardView {
  cards: MonitorDashboardCards;
  turns: MonitorDashboardTurnRow[];
  coachingHints: string[];
  recurringIssues: string[];
  executiveKpis?: MonitorExecutiveKpis | null;
  learningMetrics?: MonitorLearningMetrics;
  charts?: MonitorChartsView;
  improvementBrief?: string;
  improvementBriefSections?: MonitorImprovementBriefSection[];
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Parse numbered improvement brief sections when present. */
export function parseImprovementBriefSections(
  brief: string
): MonitorImprovementBriefSection[] | undefined {
  const trimmed = brief.trim();
  if (!trimmed) return undefined;

  const sections: MonitorImprovementBriefSection[] = [];
  const pattern = /(?:^|\n)\s*(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\s*\d+\.\s*|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(trimmed)) !== null) {
    const title = match[2]?.trim();
    const body = match[3]?.trim();
    if (title) sections.push({ title, body: body ?? '' });
  }

  return sections.length > 0 ? sections : undefined;
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

  const issueLabels = Array.isArray(raw.issue_labels)
    ? raw.issue_labels.filter((label): label is string => typeof label === 'string')
    : undefined;

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
    issueLabels,
    latencyMs: readNumber(raw.latency_ms),
    createdAt,
    verifyPass: typeof raw.verify_pass === 'boolean' ? raw.verify_pass : null,
    buildGatePass: typeof raw.build_gate_pass === 'boolean' ? raw.build_gate_pass : null,
    changedFileCount: readNumber(raw.changed_file_count),
  };
}

function parseExecutiveKpis(raw: unknown): MonitorExecutiveKpis | null {
  const obj = readRecord(raw);
  if (!obj) return null;

  const reliabilityScore =
    obj.reliability_score === null
      ? null
      : readNumber(obj.reliability_score);

  const components = readRecord(obj.reliability_components);
  const operations = readRecord(obj.operations);

  return {
    reliabilityScore,
    reliabilityGrade: readString(obj.reliability_grade),
    reliabilityStrong: readBool(obj.reliability_strong),
    reliabilityComponents: components
      ? {
          success: readNumber(components.success),
          verify: readNumber(components.verify),
          build: readNumber(components.build),
          recovery: readNumber(components.recovery),
        }
      : undefined,
    operations: operations
      ? {
          turnsToFirstSuccess: readNumber(operations.turns_to_first_success),
          meanRecoveryTurns: readNumber(operations.mean_recovery_turns),
          stabilityScore: readNumber(operations.stability_score),
          stableSession: readBool(operations.stable_session),
          failureBlastRadius: readNumber(operations.failure_blast_radius),
          agentUptime: readNumber(operations.agent_uptime),
          sessionResolved: readBool(operations.session_resolved),
        }
      : undefined,
  };
}

function parseLearningMetrics(raw: unknown): MonitorLearningMetrics | undefined {
  const obj = readRecord(raw);
  if (!obj) return undefined;

  const proofSummary = readRecord(obj.proof_summary);
  const coachingEffectiveness = readRecord(obj.coaching_effectiveness);
  const issueDecay = readRecord(obj.issue_decay);
  const recovery = readRecord(obj.recovery);
  const coachingAdoption = readRecord(obj.coaching_adoption);

  const proofFlags: Record<string, boolean> = {};
  if (proofSummary) {
    for (const [key, value] of Object.entries(proofSummary)) {
      if (typeof value === 'boolean') proofFlags[key] = value;
    }
  }

  const coachingNums: Record<string, number> = {};
  if (coachingEffectiveness) {
    for (const [key, value] of Object.entries(coachingEffectiveness)) {
      const num = readNumber(value);
      if (num != null) coachingNums[key] = num;
    }
    const verifyLift = readNumber(obj.coaching_lift_verify_pass_rate);
    const buildLift = readNumber(obj.coaching_lift_build_gate_pass_rate);
    if (verifyLift != null) coachingNums.coaching_lift_verify_pass_rate = verifyLift;
    if (buildLift != null) coachingNums.coaching_lift_build_gate_pass_rate = buildLift;
  }

  return {
    proofSummary: Object.keys(proofFlags).length > 0 ? proofFlags : undefined,
    coachingEffectiveness:
      Object.keys(coachingNums).length > 0 ? coachingNums : undefined,
    learningVelocitySlope: readNumber(obj.learning_velocity_slope),
    learningVelocityImproving: readBool(obj.learning_velocity_improving),
    timeToCompetencyTurnIndex: readNumber(obj.time_to_competency_turn_index),
    issueDecay: issueDecay
      ? {
          firstHalfIssueCount: readNumber(issueDecay.first_half_issue_count),
          secondHalfIssueCount: readNumber(issueDecay.second_half_issue_count),
          issueDecayDelta: readNumber(issueDecay.issue_decay_delta),
        }
      : undefined,
    recovery: recovery
      ? {
          recoveryRate: readNumber(recovery.recovery_rate),
          recoverySuccessCount: readNumber(recovery.recovery_success_count),
          recoveryEligibleTurns: readNumber(recovery.recovery_eligible_turns),
        }
      : undefined,
    coachingAdoption: coachingAdoption
      ? {
          coachingAdoptionRate: readNumber(coachingAdoption.coaching_adoption_rate),
          coachedTurnCount: readNumber(coachingAdoption.coached_turn_count),
          avgCoachingHintCount: readNumber(coachingAdoption.avg_coaching_hint_count),
        }
      : undefined,
  };
}

function parseCharts(raw: unknown): MonitorChartsView | undefined {
  const obj = readRecord(raw);
  if (!obj) return undefined;

  const scoreSeries = Array.isArray(obj.score_series)
    ? obj.score_series
        .map((point) => {
          const row = readRecord(point);
          if (!row) return null;
          const turnIndex = readNumber(row.turn_index);
          if (turnIndex == null) return null;
          const seriesPoint: MonitorScoreSeriesPoint = { turnIndex };
          const overallScore = readNumber(row.overall_score);
          const grade = readString(row.grade);
          if (overallScore != null) seriesPoint.overallScore = overallScore;
          if (grade) seriesPoint.grade = grade;
          return seriesPoint;
        })
        .filter((row): row is MonitorScoreSeriesPoint => row != null)
    : [];

  const issuePareto = Array.isArray(obj.issue_pareto)
    ? obj.issue_pareto
        .map((row) => {
          const item = readRecord(row);
          if (!item) return null;
          const label = readString(item.label);
          const count = readNumber(item.count);
          if (!label || count == null) return null;
          return { label, count };
        })
        .filter((row): row is MonitorIssueParetoRow => row != null)
    : [];

  const gateRaw = readRecord(obj.gate_funnel);
  const gateFunnel = gateRaw
    ? {
        totalTurns: readNumber(gateRaw.total_turns),
        outcomeSuccess: readNumber(gateRaw.outcome_success),
        verifyPass: readNumber(gateRaw.verify_pass),
        buildGatePass: readNumber(gateRaw.build_gate_pass),
      }
    : undefined;

  const experimentBreakdown: Record<string, number> = {};
  const expRaw = readRecord(obj.experiment_breakdown);
  if (expRaw) {
    for (const [key, value] of Object.entries(expRaw)) {
      const count = readNumber(value);
      if (count != null) experimentBreakdown[key] = count;
    }
  }

  const latencyRaw = readRecord(obj.latency) ?? readRecord(obj.trends);
  const latency = latencyRaw
    ? {
        avg: readNumber(latencyRaw.avg ?? latencyRaw.avg_latency_ms),
        min: readNumber(latencyRaw.min),
        max: readNumber(latencyRaw.max),
        p50: readNumber(latencyRaw.p50),
      }
    : undefined;

  return {
    scoreSeries,
    issuePareto,
    gateFunnel,
    experimentBreakdown,
    latency,
    latencyDeltaFirstToLastMs: readNumber(obj.latency_delta_first_to_last_ms),
  };
}

/** Parse Site Monitor dashboard API response (non-throwing). */
export function parseMonitorDashboardResponse(
  raw: Record<string, unknown> | null | undefined
): MonitorDashboardView | null {
  const dashboard = raw?.dashboard;
  if (!dashboard || typeof dashboard !== 'object') return null;

  const dash = dashboard as Record<string, unknown>;
  const cardsRaw = dash.cards;
  const cardsObj =
    cardsRaw && typeof cardsRaw === 'object' ? (cardsRaw as Record<string, unknown>) : {};

  const turnsRaw = dash.turns;
  const turns = Array.isArray(turnsRaw)
    ? turnsRaw
        .map((row) =>
          row && typeof row === 'object'
            ? parseMonitorDashboardTurn(row as Record<string, unknown>)
            : null
        )
        .filter((row): row is MonitorDashboardTurnRow => row != null)
    : [];

  const coachingHints = Array.isArray(dash.coaching_hints)
    ? dash.coaching_hints.filter(
        (hint): hint is string => typeof hint === 'string' && hint.trim().length > 0
      )
    : [];

  const recurringIssues = Array.isArray(dash.recurring_issues)
    ? dash.recurring_issues.filter(
        (issue): issue is string => typeof issue === 'string' && issue.trim().length > 0
      )
    : [];

  const improvementBrief = readString(dash.improvement_brief);

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
      outcomeSuccessRate: readNumber(cardsObj.outcome_success_rate),
      verifyPassRate: readNumber(cardsObj.verify_pass_rate),
      buildGatePassRate: readNumber(cardsObj.build_gate_pass_rate),
      avgLatencyMs: readNumber(cardsObj.avg_latency_ms),
    },
    turns,
    coachingHints,
    recurringIssues,
    executiveKpis: parseExecutiveKpis(dash.executive_kpis),
    learningMetrics: parseLearningMetrics(dash.learning_metrics),
    charts: parseCharts(dash.charts),
    improvementBrief,
    improvementBriefSections: improvementBrief
      ? parseImprovementBriefSections(improvementBrief)
      : undefined,
  };
}

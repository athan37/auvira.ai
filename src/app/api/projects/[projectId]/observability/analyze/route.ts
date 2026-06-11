import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import {
  DASHBOARD_TURN_LIMIT,
  DEFAULT_OBSERVABILITY_PROBE_MESSAGE,
  INTENT_PROFILE_TURN_LIMIT,
} from '@/lib/observability/analyticsConstants';
import {
  fetchObservabilityContextDetailed,
  fetchObservabilityDashboardDetailed,
  fetchObservabilityIntentProfileDetailed,
} from '@/lib/observability/client';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { parseCoachingContext } from '@/lib/observability/fetchCoachingContext';
import { parseIntentProfileResponse } from '@/lib/observability/parseIntentProfile';
import { parseMonitorDashboardResponse } from '@/lib/observability/parseMonitorDashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnalyzeBody {
  conversationId?: string;
}

/**
 * POST /api/projects/{projectId}/observability/analyze — parallel Monitor session fetch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  if (!isObservabilityEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Site Monitor is not enabled' },
      { status: 503 }
    );
  }

  let body: AnalyzeBody = {};
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    body = {};
  }

  const conversationId =
    body.conversationId?.trim() || editorConversationId(params.projectId);
  const contextMessage = DEFAULT_OBSERVABILITY_PROBE_MESSAGE;

  const errors: Array<{ source: string; status: number; message: string }> = [];

  const [dashboardResult, intentResult, contextResult] = await Promise.all([
    fetchObservabilityDashboardDetailed({
      projectId: params.projectId,
      conversationId,
      turnLimit: DASHBOARD_TURN_LIMIT,
    }),
    fetchObservabilityIntentProfileDetailed({
      projectId: params.projectId,
      turnLimit: INTENT_PROFILE_TURN_LIMIT,
    }),
    fetchObservabilityContextDetailed({
      projectId: params.projectId,
      conversationId,
      latestUserMessage: contextMessage,
    }),
  ]);

  if (!dashboardResult.ok) {
    errors.push({
      source: 'dashboard',
      status: dashboardResult.status,
      message:
        dashboardResult.status === 404
          ? 'Conversation not found'
          : dashboardResult.error ?? 'Dashboard request failed',
    });
  }

  if (!intentResult.ok) {
    errors.push({
      source: 'intent',
      status: intentResult.status,
      message: intentResult.error ?? 'Intent profile request failed',
    });
  }

  if (!contextResult.ok) {
    errors.push({
      source: 'context',
      status: contextResult.status,
      message: contextResult.error ?? 'Context request failed',
    });
  }

  const monitorDashboard = parseMonitorDashboardResponse(dashboardResult.data ?? undefined);
  const intentProfile = parseIntentProfileResponse(intentResult.data ?? undefined);

  const rawContext =
    contextResult.data?.context && typeof contextResult.data.context === 'object'
      ? (contextResult.data.context as Record<string, unknown>)
      : null;

  return NextResponse.json({
    ok: errors.length === 0 || Boolean(monitorDashboard || intentProfile || rawContext),
    projectId: params.projectId,
    projectName: project.name ?? 'Project',
    conversationId,
    monitorEnabled: true,
    sessionSummary: monitorDashboard?.cards ?? null,
    intentProfile,
    coachingContext: rawContext
      ? {
          raw: rawContext,
          parsed: parseCoachingContext(rawContext),
        }
      : null,
    developerAnalytics: monitorDashboard
      ? {
          executiveKpis: monitorDashboard.executiveKpis,
          learningMetrics: monitorDashboard.learningMetrics,
          charts: monitorDashboard.charts,
          turns: monitorDashboard.turns,
          improvementBrief: monitorDashboard.improvementBrief,
          improvementBriefSections: monitorDashboard.improvementBriefSections,
          coachingHints: monitorDashboard.coachingHints,
          recurringIssues: monitorDashboard.recurringIssues,
        }
      : null,
    errors,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { aggregateProjectObservabilityMetrics } from '@/lib/metrics/aggregateObservabilityMetrics';
import {
  fetchObservabilityContextRaw,
  fetchObservabilityDashboardRaw,
  fetchObservabilityIntentProfileRaw,
} from '@/lib/observability/client';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { parseCoachingContext } from '@/lib/observability/fetchCoachingContext';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';
import { extractColorFromIntentSentence } from '@/lib/observability/intentSentence';
import { parseIntentProfileResponse } from '@/lib/observability/parseIntentProfile';
import { parseMonitorDashboardResponse } from '@/lib/observability/parseMonitorDashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/{projectId}/observability — project owner dashboard data.
 */
export async function GET(
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

  const daysParam = Number(request.nextUrl.searchParams.get('days') || '7');
  const days = Number.isFinite(daysParam) ? Math.max(1, daysParam) : 7;
  const probeMessage = request.nextUrl.searchParams.get('probeMessage')?.trim() || undefined;

  const monitorEnabled = isObservabilityEnabled();
  const conversationId = editorConversationId(params.projectId);

  const [metrics, contextResponse, dashboardResponse, intentProfileResponse, probeIntent] =
    await Promise.all([
      aggregateProjectObservabilityMetrics({ projectId: params.projectId, days }),
      monitorEnabled
        ? fetchObservabilityContextRaw({
            projectId: params.projectId,
            conversationId,
            latestUserMessage: probeMessage,
          })
        : Promise.resolve(null),
      monitorEnabled
        ? fetchObservabilityDashboardRaw({ projectId: params.projectId, conversationId })
        : Promise.resolve(null),
      monitorEnabled
        ? fetchObservabilityIntentProfileRaw({ projectId: params.projectId })
        : Promise.resolve(null),
      monitorEnabled && probeMessage
        ? fetchObservabilityIntent({
            projectId: params.projectId,
            userMessage: probeMessage,
            conversationId,
          })
        : Promise.resolve(null),
    ]);

  const rawContext =
    contextResponse?.context && typeof contextResponse.context === 'object'
      ? (contextResponse.context as Record<string, unknown>)
      : null;

  const monitorDashboard = parseMonitorDashboardResponse(dashboardResponse ?? undefined);
  const intentProfile = parseIntentProfileResponse(intentProfileResponse ?? undefined);
  const probeIntentSentence = probeIntent?.sentence?.trim();
  const probeExtractedColor = probeIntentSentence
    ? extractColorFromIntentSentence(probeIntentSentence)
    : null;

  return NextResponse.json({
    ok: true,
    projectId: params.projectId,
    projectName: project.name ?? 'Project',
    days,
    monitorEnabled,
    summary: metrics.summary,
    turns: metrics.turns,
    monitorDashboard,
    intentProfile,
    probeIntent: probeIntentSentence
      ? { sentence: probeIntentSentence, extractedColor: probeExtractedColor }
      : null,
    liveContext: rawContext
      ? {
          raw: rawContext,
          parsed: parseCoachingContext(rawContext),
        }
      : null,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject, getServerUserId } from '@/lib/api/projectAccess';
import { aggregateProjectObservabilityMetrics } from '@/lib/metrics/aggregateObservabilityMetrics';
import { fetchObservabilityContextRaw } from '@/lib/observability/client';
import { isObservabilityEnabled } from '@/lib/observability/config';
import { editorConversationId } from '@/lib/observability/conversationId';
import { parseCoachingContext } from '@/lib/observability/fetchCoachingContext';

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

  const [metrics, contextResponse] = await Promise.all([
    aggregateProjectObservabilityMetrics({ projectId: params.projectId, days }),
    monitorEnabled
      ? fetchObservabilityContextRaw({
          projectId: params.projectId,
          conversationId: editorConversationId(params.projectId),
          latestUserMessage: probeMessage,
        })
      : Promise.resolve(null),
  ]);

  const rawContext =
    contextResponse?.context && typeof contextResponse.context === 'object'
      ? (contextResponse.context as Record<string, unknown>)
      : null;

  return NextResponse.json({
    ok: true,
    projectId: params.projectId,
    projectName: project.name ?? 'Project',
    days,
    monitorEnabled,
    summary: metrics.summary,
    turns: metrics.turns,
    liveContext: rawContext
      ? {
          raw: rawContext,
          parsed: parseCoachingContext(rawContext),
        }
      : null,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProjectLog } from '@/models/WebsiteProjectLog';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;
  const { projectId } = params;

  // Only allow in development or for admin users
  if (process.env.NODE_ENV !== 'development' && !request.nextUrl.searchParams.get('admin')) {
    return NextResponse.json({ ok: false, error: 'Logs API only available in development' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const operation = searchParams.get('operation') || undefined;
  const runId = searchParams.get('runId') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  const query: Record<string, unknown> = { projectId };
  if (operation) query.operation = operation;
  if (runId) query.runId = runId;

  const logs = await WebsiteProjectLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Group logs by runId
  const logsByRun: Record<string, typeof logs> = {};
  for (const log of logs) {
    const rid = log.runId;
    if (!logsByRun[rid]) logsByRun[rid] = [];
    logsByRun[rid].push(log);
  }

  return NextResponse.json({
    ok: true,
    projectId,
    logs,
    runs: Object.entries(logsByRun).map(([runId, runLogs]) => ({
      runId,
      operation: runLogs[0]?.operation,
      steps: runLogs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    })),
  });
}
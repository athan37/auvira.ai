import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { aggregateEditMetrics } from '@/lib/metrics/aggregateEditMetrics';
import { aggregateObservabilityMetrics } from '@/lib/metrics/aggregateObservabilityMetrics';

/**
 * GET /api/admin/observability — Arize turn scores and recent traced edits.
 */
export async function GET(request: NextRequest) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days') || '7');
  const days = Number.isFinite(daysParam) ? daysParam : 7;

  const [edit, observability] = await Promise.all([
    aggregateEditMetrics({ days, userId }),
    aggregateObservabilityMetrics({ days }),
  ]);

  return NextResponse.json({
    ok: true,
    days,
    edit,
    observability,
  });
}

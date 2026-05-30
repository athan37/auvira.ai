import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { aggregateEditMetrics } from '@/lib/metrics/aggregateEditMetrics';
import { aggregateGenerationMetrics } from '@/lib/metrics/generationMetrics';

/**
 * GET /api/admin/metrics — edit latency and generation funnel baselines (authenticated).
 */
export async function GET(request: NextRequest) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days') || '7');
  const days = Number.isFinite(daysParam) ? daysParam : 7;

  const [edit, generation] = await Promise.all([
    aggregateEditMetrics({ days, userId }),
    aggregateGenerationMetrics({ days }),
  ]);

  return NextResponse.json({
    ok: true,
    days,
    edit,
    generation,
  });
}

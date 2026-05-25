import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { runWatchChecks } from '@/lib/site-manager/watchRunner.service';
import type { MonitorType } from '@/lib/site-manager/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await runWatchChecks(params.projectId, {
      monitorTypes: body.monitorTypes as MonitorType[] | undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check failed' },
      { status: 400 }
    );
  }
}

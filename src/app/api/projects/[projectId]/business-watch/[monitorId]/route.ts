import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { setMonitorEnabled } from '@/lib/site-manager/watchRules.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; monitorId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const monitor = await setMonitorEnabled(params.projectId, params.monitorId, Boolean(body.enabled));
  if (!monitor) return NextResponse.json({ ok: false, error: 'Monitor not found' }, { status: 404 });
  return NextResponse.json({ ok: true, monitor: { id: monitor._id.toString(), enabled: monitor.enabled } });
}

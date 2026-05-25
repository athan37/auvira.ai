import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getBusinessProfile } from '@/lib/site-manager/businessProfile.service';
import { suggestMonitorsFromProfile } from '@/lib/site-manager/watchRules.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const profile = await getBusinessProfile(params.projectId);
  if (!profile?.confirmedAt) {
    return NextResponse.json({ ok: false, error: 'Confirm business details first' }, { status: 400 });
  }
  const monitors = await suggestMonitorsFromProfile(
    params.projectId,
    project.ownerId.toString(),
    profile
  );
  return NextResponse.json({ ok: true, count: monitors.length });
}

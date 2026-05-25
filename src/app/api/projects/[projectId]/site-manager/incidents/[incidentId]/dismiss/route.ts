import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { dismissIncident } from '@/lib/site-manager/incidents.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string; incidentId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const incident = await dismissIncident(params.projectId, params.incidentId);
  if (!incident) return NextResponse.json({ ok: false, error: 'Incident not found' }, { status: 404 });
  return NextResponse.json({ ok: true, status: incident.status });
}

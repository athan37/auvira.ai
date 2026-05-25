import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getBusinessWatchSummary } from '@/lib/site-manager/businessWatchSummary.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  const summary = await getBusinessWatchSummary(params.projectId);
  return NextResponse.json({ ok: true, ...summary });
}

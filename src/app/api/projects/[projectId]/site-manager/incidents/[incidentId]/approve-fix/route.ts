import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { executeApprovedFix } from '@/lib/site-manager/remediation.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string; incidentId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, message: 'Project not found or you do not have access.' }, { status: 404 });
  }
  try {
    const result = await executeApprovedFix(
      params.projectId,
      params.incidentId,
      project.ownerId.toString()
    );
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Fix failed' },
      { status: 500 }
    );
  }
}

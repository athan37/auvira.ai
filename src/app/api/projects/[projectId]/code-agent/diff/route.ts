import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getLatestEditJob } from '@/lib/project-workspace/editJobLogger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const requestedJobId = request.nextUrl.searchParams.get('jobId') || undefined;
  const job = await getLatestEditJob(params.projectId, requestedJobId);

  if (!job) {
    return NextResponse.json({
      ok: true,
      jobId: null,
      requestedJobId: requestedJobId ?? null,
      status: null,
      changedFiles: [],
      summary: null,
      error: requestedJobId
        ? 'Edit job not found for this project. It may have expired or the edit never finished saving.'
        : null,
      buildLog: null,
      logs: [],
    });
  }

  return NextResponse.json({
    ok: true,
    jobId: job._id.toString(),
    requestedJobId: requestedJobId ?? null,
    status: job.status,
    changedFiles: job.changedFiles ?? [],
    summary: job.summary || null,
    error: job.error || null,
    buildLog: job.buildLog || null,
    logs: job.logs ?? [],
    prompt: job.prompt,
  });
}

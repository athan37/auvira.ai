import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { getLatestEditJob } from '@/lib/project-workspace/editJobLogger';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.projectId;
  const project = await WebsiteProject.findOne({ _id: projectId, ownerId: userId });
  if (!project) {
    return NextResponse.json({ detail: 'Project not found' }, { status: 404 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId') || undefined;
  const job = await getLatestEditJob(projectId, jobId);

  if (!job) {
    return NextResponse.json({
      ok: true,
      jobId: null,
      status: null,
      changedFiles: [],
      summary: null,
      error: null,
      buildLog: null,
      logs: [],
    });
  }

  return NextResponse.json({
    ok: true,
    jobId: job._id.toString(),
    status: job.status,
    changedFiles: job.changedFiles,
    summary: job.summary || null,
    error: job.error || null,
    buildLog: job.buildLog || null,
    logs: job.logs,
  });
}

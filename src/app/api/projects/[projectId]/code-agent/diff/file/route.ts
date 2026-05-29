import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getLatestEditJob } from '@/lib/project-workspace/editJobLogger';
import type { IChangedFile } from '@/models/ProjectEditJob';
import {
  buildEditJobFilePatch,
  readEditJobFileRevision,
} from '@/lib/project-workspace/editJobFileDiff';

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

  const jobId = request.nextUrl.searchParams.get('jobId');
  const filePath = request.nextUrl.searchParams.get('path');
  if (!jobId || !filePath) {
    return NextResponse.json(
      { ok: false, error: 'jobId and path query parameters are required.' },
      { status: 400 }
    );
  }

  const job = await getLatestEditJob(params.projectId, jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: 'Edit job not found.' }, { status: 404 });
  }

  const normalizedRequestPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const entry = job.changedFiles.find(
    (f: IChangedFile) => f.path.replace(/\\/g, '/') === normalizedRequestPath
  );
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: 'File is not listed on this edit job.' },
      { status: 400 }
    );
  }

  try {
    const revision = await readEditJobFileRevision(job, entry.path);
    const diff = buildEditJobFilePatch(entry.path, revision, entry.status);
    return NextResponse.json({ ok: true, ...diff });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not build file diff.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

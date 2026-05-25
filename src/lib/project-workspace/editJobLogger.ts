import mongoose from 'mongoose';
import {
  ProjectEditJob,
  type IChangedFile,
  type IProjectEditJob,
  type ProjectEditJobStatus,
} from '@/models/ProjectEditJob';
import type { EditFailureReport } from './editFailureDetail';

export async function createEditJob(params: {
  projectId: string;
  userId: string;
  prompt: string;
  previewVersionBefore?: number;
  workspacePath?: string;
}): Promise<IProjectEditJob> {
  const job = await ProjectEditJob.create({
    projectId: new mongoose.Types.ObjectId(params.projectId),
    userId: new mongoose.Types.ObjectId(params.userId),
    status: 'running',
    prompt: params.prompt,
    previewVersionBefore: params.previewVersionBefore,
    workspacePath: params.workspacePath,
    changedFiles: [],
    logs: [
      {
        type: 'job_created',
        message: 'Edit job created',
        createdAt: new Date(),
      },
    ],
  });
  return job;
}

export async function appendEditJobLog(
  jobId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ProjectEditJob.updateOne(
    { _id: jobId },
    {
      $push: {
        logs: {
          type,
          message,
          metadata,
          createdAt: new Date(),
        },
      },
    }
  );
}

/** Persist a full copy/paste trace plus structured metadata on the edit job. */
export async function logEditFailureTrace(
  jobId: string,
  report: EditFailureReport
): Promise<void> {
  const shortMsg =
    (report.metadata.technicalMessage as string | undefined) ||
    (report.metadata.stage as string | undefined) ||
    'Edit failed';

  await appendEditJobLog(jobId, 'error_detail', truncateLogMessage(shortMsg), {
    stage: report.metadata.stage,
    jobId: report.metadata.jobId,
    projectId: report.metadata.projectId,
  });

  await appendEditJobLog(jobId, 'error_trace', 'Full failure trace (copy from metadata.copyText)', {
    ...report.metadata,
    copyText: report.copyText,
  });
}

function truncateLogMessage(msg: string, max = 500): string {
  return msg.length <= max ? msg : `${msg.slice(0, max)}…`;
}

export async function markEditJobStatus(
  jobId: string,
  status: ProjectEditJobStatus,
  extra?: Partial<{
    error: string;
    buildLog: string;
    summary: string;
    previewVersionAfter: number;
    snapshotPath: string;
    workspacePath: string;
    baseCommitSha: string;
  }>
): Promise<void> {
  await ProjectEditJob.updateOne({ _id: jobId }, { $set: { status, ...extra } });
}

export async function attachChangedFiles(jobId: string, changedFiles: IChangedFile[]): Promise<void> {
  await ProjectEditJob.updateOne(
    { _id: jobId },
    {
      $set: { changedFiles },
      $push: {
        logs: {
          type: 'files_changed',
          message: `Changed ${changedFiles.length} file(s)`,
          metadata: { paths: changedFiles.map((f) => f.path) },
          createdAt: new Date(),
        },
      },
    }
  );
}

export async function getLatestEditJob(projectId: string, jobId?: string) {
  const projectOid = new mongoose.Types.ObjectId(projectId);

  if (jobId) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return null;
    }
    return ProjectEditJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      projectId: projectOid,
    });
  }
  return ProjectEditJob.findOne({ projectId: projectOid }).sort({ createdAt: -1 });
}

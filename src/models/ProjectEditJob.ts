import mongoose, { Schema, Document } from 'mongoose';

export type ProjectEditJobStatus =
  | 'queued'
  | 'running'
  | 'validating'
  | 'ready'
  | 'failed'
  | 'deployed'
  | 'reverted';

export type ChangedFileStatus = 'added' | 'modified' | 'deleted';

export interface IChangedFile {
  path: string;
  status: ChangedFileStatus;
  additions?: number;
  deletions?: number;
}

export interface IEditJobLogEntry {
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IProjectEditJob extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: ProjectEditJobStatus;
  prompt: string;
  workspacePath?: string;
  snapshotPath?: string;
  baseCommitSha?: string;
  changedFiles: IChangedFile[];
  previewVersionBefore?: number;
  previewVersionAfter?: number;
  summary?: string;
  error?: string;
  buildLog?: string;
  logs: IEditJobLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const ChangedFileSchema = new Schema<IChangedFile>(
  {
    path: { type: String, required: true },
    status: { type: String, enum: ['added', 'modified', 'deleted'], required: true },
    additions: Number,
    deletions: Number,
  },
  { _id: false }
);

const EditJobLogSchema = new Schema<IEditJobLogEntry>(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectEditJobSchema = new Schema<IProjectEditJob>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'validating', 'ready', 'failed', 'deployed', 'reverted'],
      default: 'queued',
      index: true,
    },
    prompt: { type: String, required: true },
    workspacePath: String,
    snapshotPath: String,
    baseCommitSha: String,
    changedFiles: { type: [ChangedFileSchema], default: [] },
    previewVersionBefore: Number,
    previewVersionAfter: Number,
    summary: String,
    error: String,
    buildLog: String,
    logs: { type: [EditJobLogSchema], default: [] },
  },
  { timestamps: true }
);

ProjectEditJobSchema.index({ projectId: 1, createdAt: -1 });
ProjectEditJobSchema.index({ userId: 1, createdAt: -1 });

export const ProjectEditJob =
  mongoose.models.ProjectEditJob ??
  mongoose.model<IProjectEditJob>('ProjectEditJob', ProjectEditJobSchema);

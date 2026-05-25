import mongoose, { Schema, Document } from 'mongoose';

export type ActionType =
  | 'clone_created'
  | 'scratch_created'
  | 'chat_edit'
  | 'build_validation'
  | 'gitlab_commit'
  | 'save_code_workspace_changes'
  | 'force_sync_workspace_to_gitlab'
  | 'vercel_deploy'
  | 'deploy_code_workspace_changes'
  | 'deploy_preview_changes'
  | 'watch_created'
  | 'watch_failed'
  | 'fix_proposed'
  | 'fix_approved'
  | 'fix_applied'
  | 'fix_failed'
  | 'owner_notified';

export interface IProjectAction extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  type: ActionType;
  status: 'started' | 'succeeded' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  commitSha?: string;
  deploymentId?: string;
  createdAt: Date;
  completedAt?: Date;
}

const ProjectActionSchema = new Schema<IProjectAction>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'clone_created',
        'scratch_created',
        'chat_edit',
        'build_validation',
        'gitlab_commit',
        'save_code_workspace_changes',
        'force_sync_workspace_to_gitlab',
        'vercel_deploy',
        'deploy_code_workspace_changes',
        'deploy_preview_changes',
        'watch_created',
        'watch_failed',
        'fix_proposed',
        'fix_approved',
        'fix_applied',
        'fix_failed',
        'owner_notified',
      ],
      required: true,
    },
    status: { type: String, enum: ['started', 'succeeded', 'failed'], required: true },
    input: { type: Schema.Types.Mixed },
    output: { type: Schema.Types.Mixed },
    error: String,
    commitSha: String,
    deploymentId: String,
    completedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProjectActionSchema.index({ projectId: 1, createdAt: -1 });

// Next.js dev hot reload keeps a stale model — re-register when enum schema changes.
if (process.env.NODE_ENV !== 'production' && mongoose.models.ProjectAction) {
  mongoose.deleteModel('ProjectAction');
}

export const ProjectAction =
  mongoose.models.ProjectAction ??
  mongoose.model<IProjectAction>('ProjectAction', ProjectActionSchema);
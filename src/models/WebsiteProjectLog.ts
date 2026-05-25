import mongoose, { Schema, Document } from 'mongoose';

export interface IWebsiteProjectLog extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  runId: string;
  operation: 'generation' | 'workspace_ensure' | 'owner_edit' | 'preview' | 'deploy' | 'gitlab' | 'vercel';
  step: string;
  status: 'started' | 'success' | 'failed' | 'skipped' | 'warning';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata: mongoose.Schema.Types.Mixed;
  error?: {
    message?: string;
    stack?: string;
    code?: string;
    cause?: mongoose.Schema.Types.Mixed;
  };
  durationMs?: number;
  createdAt: Date;
}

const WebsiteProjectLogSchema = new Schema<IWebsiteProjectLog>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'WebsiteProject',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  runId: {
    type: String,
    required: true,
    index: true,
  },
  operation: {
    type: String,
    enum: ['generation', 'workspace_ensure', 'owner_edit', 'preview', 'deploy', 'gitlab', 'vercel'],
    required: true,
    index: true,
  },
  step: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['started', 'success', 'failed', 'skipped', 'warning'],
    required: true,
  },
  level: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'info',
  },
  message: {
    type: String,
    required: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: undefined,
  },
  error: {
    message: String,
    stack: String,
    code: String,
    cause: Schema.Types.Mixed,
  },
  durationMs: {
    type: Number,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

// Indexes for common queries
WebsiteProjectLogSchema.index({ projectId: 1, createdAt: -1 });
WebsiteProjectLogSchema.index({ runId: 1, createdAt: 1 });
WebsiteProjectLogSchema.index({ operation: 1, status: 1, createdAt: -1 });

export const WebsiteProjectLog = mongoose.models.WebsiteProjectLog
  ?? mongoose.model<IWebsiteProjectLog>('WebsiteProjectLog', WebsiteProjectLogSchema);
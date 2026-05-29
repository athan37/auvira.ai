import mongoose, { Schema, Document } from 'mongoose';
import type { ProjectMessageMetadata } from '@/lib/chat/projectMessageMetadata';

export interface IProjectMessage extends Document {
  projectId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: ProjectMessageMetadata;
  createdAt: Date;
}

const ProjectMessageSchema = new Schema<IProjectMessage>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProjectMessageSchema.index({ projectId: 1, createdAt: 1 });

export const ProjectMessage = mongoose.models.ProjectMessage ?? mongoose.model<IProjectMessage>('ProjectMessage', ProjectMessageSchema);
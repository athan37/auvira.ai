import mongoose, { Schema, Document } from 'mongoose';

export interface IComponentAnalyticsTotal extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  componentId: string;
  componentType: 'hero' | 'section' | 'cta';
  componentLabel?: string;
  impressions: number;
  focusMs: number;
  clicks: number;
  uniqueSessions: number;
  sessionHashes: string[];
  updatedAt: Date;
}

const ComponentAnalyticsTotalSchema = new Schema<IComponentAnalyticsTotal>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    componentId: { type: String, required: true },
    componentType: { type: String, enum: ['hero', 'section', 'cta'], required: true },
    componentLabel: String,
    impressions: { type: Number, default: 0 },
    focusMs: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    uniqueSessions: { type: Number, default: 0 },
    sessionHashes: { type: [String], default: [], select: false },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

ComponentAnalyticsTotalSchema.index({ projectId: 1, componentId: 1 }, { unique: true });

export const ComponentAnalyticsTotal =
  mongoose.models.ComponentAnalyticsTotal ??
  mongoose.model<IComponentAnalyticsTotal>('ComponentAnalyticsTotal', ComponentAnalyticsTotalSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IComponentAnalyticsWeekly extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  weekStart: Date;
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

const ComponentAnalyticsWeeklySchema = new Schema<IComponentAnalyticsWeekly>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weekStart: { type: Date, required: true, index: true },
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

ComponentAnalyticsWeeklySchema.index(
  { projectId: 1, weekStart: 1, componentId: 1 },
  { unique: true }
);

export const ComponentAnalyticsWeekly =
  mongoose.models.ComponentAnalyticsWeekly ??
  mongoose.model<IComponentAnalyticsWeekly>(
    'ComponentAnalyticsWeekly',
    ComponentAnalyticsWeeklySchema
  );

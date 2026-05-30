import mongoose, { Schema, Document } from 'mongoose';

export type AnalyticsEventType = 'view' | 'focus' | 'click';
export type AnalyticsComponentType = 'hero' | 'section' | 'cta';

export interface IAnalyticsEvent {
  type: AnalyticsEventType;
  componentId: string;
  componentType: AnalyticsComponentType;
  componentLabel?: string;
  durationMs?: number;
  visibleRatio?: number;
  occurredAt: Date;
}

export interface IAnalyticsEventBatch extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  publicSiteKey: string;
  visitorIdHash?: string;
  sessionIdHash?: string;
  userAgentHash?: string;
  pagePath?: string;
  pageOrigin?: string;
  referrerOrigin?: string;
  events: IAnalyticsEvent[];
  receivedAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    type: { type: String, enum: ['view', 'focus', 'click'], required: true },
    componentId: { type: String, required: true },
    componentType: { type: String, enum: ['hero', 'section', 'cta'], required: true },
    componentLabel: String,
    durationMs: Number,
    visibleRatio: Number,
    occurredAt: { type: Date, required: true },
  },
  { _id: false }
);

const AnalyticsEventBatchSchema = new Schema<IAnalyticsEventBatch>({
  projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  publicSiteKey: { type: String, required: true, index: true },
  visitorIdHash: String,
  sessionIdHash: String,
  userAgentHash: String,
  pagePath: String,
  pageOrigin: String,
  referrerOrigin: String,
  events: { type: [AnalyticsEventSchema], required: true },
  receivedAt: { type: Date, default: Date.now, index: true },
});

AnalyticsEventBatchSchema.index({ projectId: 1, receivedAt: -1 });

export const AnalyticsEventBatch =
  mongoose.models.AnalyticsEventBatch ??
  mongoose.model<IAnalyticsEventBatch>('AnalyticsEventBatch', AnalyticsEventBatchSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IWebsiteAnalyticsConfig extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  publicSiteKey: string;
  enabled: boolean;
  allowedOrigins: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteAnalyticsConfigSchema = new Schema<IWebsiteAnalyticsConfig>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    publicSiteKey: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    allowedOrigins: { type: [String], default: [] },
  },
  { timestamps: true }
);

WebsiteAnalyticsConfigSchema.index({ projectId: 1 }, { unique: true });

export const WebsiteAnalyticsConfig =
  mongoose.models.WebsiteAnalyticsConfig ??
  mongoose.model<IWebsiteAnalyticsConfig>('WebsiteAnalyticsConfig', WebsiteAnalyticsConfigSchema);

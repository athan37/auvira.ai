import mongoose, { Schema, Document } from 'mongoose';
import type { MonitorSeverity, MonitorType } from '@/lib/site-manager/types';

export interface IOwnerMonitor extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  type: MonitorType;
  expectedValue: unknown;
  enabled: boolean;
  severity: MonitorSeverity;
  autoFixAllowed: boolean;
  confirmedByOwner: boolean;
  lastCheckedAt?: Date;
  lastResult?: 'pass' | 'fail';
  createdAt: Date;
  updatedAt: Date;
}

const OwnerMonitorSchema = new Schema<IOwnerMonitor>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['uptime', 'phone', 'hours', 'service_visibility', 'banner_expiry'],
      required: true,
    },
    expectedValue: { type: Schema.Types.Mixed, required: true },
    enabled: { type: Boolean, default: false },
    severity: { type: String, enum: ['critical', 'warning', 'opportunity'], required: true },
    autoFixAllowed: { type: Boolean, default: false },
    confirmedByOwner: { type: Boolean, default: false },
    lastCheckedAt: Date,
    lastResult: { type: String, enum: ['pass', 'fail'] },
  },
  { timestamps: true }
);

OwnerMonitorSchema.index({ projectId: 1, type: 1 }, { unique: true });

export const OwnerMonitor =
  mongoose.models.OwnerMonitor ?? mongoose.model<IOwnerMonitor>('OwnerMonitor', OwnerMonitorSchema);

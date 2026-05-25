import mongoose, { Schema, Document } from 'mongoose';
import type { IncidentStatus, IncidentType, MonitorSeverity } from '@/lib/site-manager/types';

export interface ISiteHealthIncident extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  monitorId: mongoose.Types.ObjectId;
  type: IncidentType;
  severity: MonitorSeverity;
  status: IncidentStatus;
  expectedValue: unknown;
  observedValue?: unknown;
  evidence?: Record<string, unknown>;
  fixAttempts: number;
  activeProposalId?: mongoose.Types.ObjectId;
  createdAt: Date;
  resolvedAt?: Date;
}

const SiteHealthIncidentSchema = new Schema<ISiteHealthIncident>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'OwnerMonitor', required: true },
    type: {
      type: String,
      enum: ['site_down', 'phone_mismatch', 'hours_mismatch', 'missing_service', 'expired_banner'],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'warning', 'opportunity'], required: true },
    status: {
      type: String,
      enum: ['open', 'fix_suggested', 'fix_approved', 'fix_applied', 'resolved', 'dismissed', 'failed'],
      default: 'open',
    },
    expectedValue: { type: Schema.Types.Mixed, required: true },
    observedValue: { type: Schema.Types.Mixed },
    evidence: { type: Schema.Types.Mixed },
    fixAttempts: { type: Number, default: 0 },
    activeProposalId: { type: Schema.Types.ObjectId, ref: 'SiteFixProposal' },
    resolvedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SiteHealthIncidentSchema.index({ projectId: 1, status: 1, createdAt: -1 });

export const SiteHealthIncident =
  mongoose.models.SiteHealthIncident ??
  mongoose.model<ISiteHealthIncident>('SiteHealthIncident', SiteHealthIncidentSchema);

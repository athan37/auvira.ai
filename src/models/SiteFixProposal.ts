import mongoose, { Schema, Document } from 'mongoose';
import type { FixProposalStatus, FixRiskLevel, ProposedChange } from '@/lib/site-manager/types';

export interface ISiteFixProposal extends Document {
  projectId: mongoose.Types.ObjectId;
  incidentId: mongoose.Types.ObjectId;
  title: string;
  plainEnglishSummary: string;
  proposedChange: ProposedChange;
  riskLevel: FixRiskLevel;
  requiresApproval: boolean;
  status: FixProposalStatus;
  createdAt: Date;
  appliedAt?: Date;
}

const SiteFixProposalSchema = new Schema<ISiteFixProposal>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject', required: true, index: true },
    incidentId: { type: Schema.Types.ObjectId, ref: 'SiteHealthIncident', required: true },
    title: { type: String, required: true },
    plainEnglishSummary: { type: String, required: true },
    proposedChange: { type: Schema.Types.Mixed, required: true },
    riskLevel: { type: String, enum: ['safe', 'medium', 'requires_owner'], default: 'safe' },
    requiresApproval: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'applied', 'rejected', 'failed'],
      default: 'pending',
    },
    appliedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SiteFixProposalSchema.index({ incidentId: 1, createdAt: -1 });

export const SiteFixProposal =
  mongoose.models.SiteFixProposal ??
  mongoose.model<ISiteFixProposal>('SiteFixProposal', SiteFixProposalSchema);

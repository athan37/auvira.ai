import mongoose, { Schema, Document } from 'mongoose';
import type { BannerRule } from '@/lib/site-manager/types';

export interface IBusinessProfile extends Document {
  projectId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  mainServices: string[];
  serviceAreas?: string[];
  pricingNotes?: string;
  bannerRules?: BannerRule[];
  confirmedAt?: Date;
  lastWatchRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BannerRuleSchema = new Schema(
  { text: { type: String, required: true }, expiresAt: { type: String, required: true } },
  { _id: false }
);

const BusinessProfileSchema = new Schema<IBusinessProfile>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'WebsiteProject',
      required: true,
      unique: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessName: String,
    phone: String,
    email: String,
    address: String,
    hours: String,
    mainServices: { type: [String], default: [] },
    serviceAreas: [String],
    pricingNotes: String,
    bannerRules: [BannerRuleSchema],
    confirmedAt: Date,
    lastWatchRunAt: Date,
  },
  { timestamps: true }
);

export const BusinessProfile =
  mongoose.models.BusinessProfile ??
  mongoose.model<IBusinessProfile>('BusinessProfile', BusinessProfileSchema);

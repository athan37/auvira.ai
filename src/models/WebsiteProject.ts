import mongoose, { Schema, Document } from 'mongoose';
import type { ProjectMemorySlot } from '@/lib/observability/types';

export type DeploymentStatus = 'pending' | 'triggered' | 'building' | 'ready' | 'failed' | 'trigger_failed';
export type ProjectMode = 'clone' | 'scratch';

export interface IDeploymentInfo {
  provider: string;
  status: DeploymentStatus;
  ready?: boolean;
  projectId?: string;
  projectUrl?: string;
  vercelProjectName?: string;
  deployHookCreated?: boolean;
  deployTriggered?: boolean;
  deployHookId?: string;
  deployHookUrl?: string;
  triggeredAt?: string;
  expectedProductionUrl?: string;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  lastDeployedCommitSha?: string;
  activeDeploymentId?: string;
  deployedAt?: string;
  note?: string;
  error?: string;
}

export interface ISiteSpec {
  siteTitle: string;
  tagline: string;
  primaryCTA: string;
  secondaryCTA: string;
  sections: Array<{
    type: string;
    title: string;
    body: string;
    items: string[];
  }>;
  designDirection: {
    tone: string;
    layout: string;
    colors: string[];
  };
}

export interface IPreview {
  status: 'not_started' | 'starting' | 'building' | 'ready' | 'failed' | 'stopped';
  url?: string;
  port?: number;
  workspacePath?: string;
  startedAt?: Date;
  error?: string;
  previewMode?: 'live' | 'workspace' | 'sandbox';
  sandboxId?: string;
  sandboxExpiresAt?: Date;
}

export type InfraStatus = 'pending' | 'ready' | 'failed';

export interface ICodeWorkspace {
  status: 'not_started' | 'setting_up' | 'ready' | 'editing' | 'failed';
  version: number;
  workspacePath?: string;
  source?: 'generated' | 'gitlab';
  branch?: string;
  headSha?: string;
  setupStage?: string;
  setupLabel?: string;
  setupError?: string;
  lastEditedAt?: Date;
  lastEditSummary?: string;
  lastValidationStatus?: 'passed' | 'failed';
  error?: string;
  sandboxWorkspace?: boolean;
}

export interface IWebsiteProject extends Document {
  ownerId: mongoose.Types.ObjectId;
  mode: ProjectMode;
  name: string;
  sourceUrl?: string;
  siteSpec: ISiteSpec;
  draftSiteSpec?: ISiteSpec;
  businessProfile?: Record<string, unknown>;
  websitePlan?: Record<string, unknown>;
  factualSiteData?: Record<string, unknown>;
  template?: {
    category: string;
    variant: string;
    reason: string;
    layoutStarterId?: string;
    categoryPresetId?: string;
  };
  generatedSiteValidation?: {
    ok: boolean;
    logs?: string;
    errors?: string[];
    durationMs?: number;
  };
  contentFidelity?: {
    passed: boolean;
    matchedContent: string[];
    missingContent: string[];
  };
  scratchValidation?: {
    ok: boolean;
    issues: string[];
  };
  gitlab: {
    projectId: number;
    repoUrl: string;
    httpUrlToRepo: string;
    webUrl?: string;
    pathWithNamespace?: string;
    defaultBranch?: string;
    lastCommitSha?: string;
  };
  deployment?: IDeploymentInfo;
  preview?: IPreview;
  codeWorkspace?: ICodeWorkspace;
  /** Migration-first infra baseline (tailwind, page wiring, types). */
  infraVersion?: number;
  infraStatus?: InfraStatus;
  infraLastError?: string;
  infraMigratedAt?: Date;
  editingMode?: 'spec' | 'code';
  status: 'draft' | 'building' | 'deployed' | 'failed' | 'archived';
  hasUnpublishedChanges?: boolean;
  lastPreviewEditedAt?: Date;
  lastPublishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt?: Date;
  /** Local fallback for Monitor GET /memory when unavailable. */
  projectMemorySlots?: ProjectMemorySlot[];
}

const WebsiteProjectSchema = new Schema<IWebsiteProject>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['clone', 'scratch'], required: true },
    name: { type: String, required: true },
    sourceUrl: { type: String },
    siteSpec: { type: Schema.Types.Mixed, required: true },
    draftSiteSpec: { type: Schema.Types.Mixed },
    businessProfile: { type: Schema.Types.Mixed },
    websitePlan: { type: Schema.Types.Mixed },
    factualSiteData: { type: Schema.Types.Mixed },
    template: {
      category: String,
      variant: String,
      reason: String,
      layoutStarterId: String,
      categoryPresetId: String,
    },
    generatedSiteValidation: { type: Schema.Types.Mixed },
    contentFidelity: { type: Schema.Types.Mixed },
    scratchValidation: { type: Schema.Types.Mixed },
    gitlab: {
      projectId: { type: Number, required: true },
      repoUrl: { type: String, required: true },
      httpUrlToRepo: { type: String, required: true },
      webUrl: String,
      pathWithNamespace: String,
      defaultBranch: { type: String, default: 'main' },
      lastCommitSha: String,
    },
    deployment: { type: Schema.Types.Mixed },
    preview: { type: Schema.Types.Mixed },
    infraVersion: { type: Number, default: 0 },
    infraStatus: { type: String, enum: ['pending', 'ready', 'failed'] },
    infraLastError: String,
    infraMigratedAt: Date,
    codeWorkspace: {
      status: {
        type: String,
        enum: ['not_started', 'setting_up', 'ready', 'editing', 'failed'],
        default: 'not_started',
      },
      setupStage: String,
      setupLabel: String,
      setupError: String,
      version: { type: Number, default: 1 },
      workspacePath: String,
      source: { type: String, enum: ['generated', 'gitlab'], default: 'generated' },
      branch: String,
      headSha: String,
      lastEditedAt: Date,
      lastEditSummary: String,
      lastValidationStatus: { type: String, enum: ['passed', 'failed'] },
      error: String,
    },
    editingMode: { type: String, enum: ['spec', 'code'], default: 'code' },
    status: {
      type: String,
      enum: ['draft', 'building', 'deployed', 'failed', 'archived'],
      default: 'draft',
    },
    hasUnpublishedChanges: { type: Boolean, default: false },
    lastPreviewEditedAt: Date,
    lastPublishedAt: Date,
    lastEditedAt: Date,
    projectMemorySlots: { type: [Schema.Types.Mixed], default: undefined },
  },
  { timestamps: true }
);

WebsiteProjectSchema.index({ ownerId: 1, updatedAt: -1 });

export const WebsiteProject = mongoose.models.WebsiteProject ?? mongoose.model<IWebsiteProject>('WebsiteProject', WebsiteProjectSchema);
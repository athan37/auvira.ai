import mongoose, { Schema, Document } from 'mongoose';

export type CloneJobStatus =
  | 'queued'
  | 'crawling'
  | 'extracting'
  | 'planning'
  | 'review_ready'
  | 'preview_building'
  | 'preview_ready'
  | 'building'
  | 'deploying'
  | 'completed'
  | 'failed';

export interface ICrawlPage {
  url: string;
  title?: string;
  status: 'queued' | 'crawling' | 'done' | 'failed' | 'skipped';
  statusCode?: number;
  textLength?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ICloneJobLog {
  timestamp: Date;
  stage: string;
  message: string;
  data?: unknown;
}

export interface IBuildStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface IDeployment {
  provider: 'vercel';
  status: 'triggered' | 'pending' | 'building' | 'ready' | 'failed';
  ready: boolean;
  vercelProjectId?: string;
  vercelProjectName?: string;
  deployHookId?: string;
  triggeredAt?: string;
  expectedProductionUrl?: string;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  note?: string;
  error?: string;
}

export interface IPreview {
  status: 'not_started' | 'building' | 'ready' | 'failed' | 'stopped';
  url?: string;
  port?: number;
  startedAt?: Date;
  error?: string;
}

export interface ITechnicalBuild {
  workspacePath?: string;
  files?: Array<{
    path: string;
    status: 'pending' | 'writing' | 'done' | 'failed';
    sizeBytes?: number;
  }>;
  validationLogs?: string;
  previewServerPid?: number;
  buildGateSkipped?: boolean;
}

export interface IBuildValidation {
  ok: boolean;
  logs?: string;
  errors?: string[];
  durationMs?: number;
  buildGateSkipped?: boolean;
}

export interface IBuildSummaryItem {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  summary?: string;
  data?: {
    title?: string;
    count?: number;
    examples?: string[];
  };
  updatedAt?: Date;
}

export interface IBuildSummary {
  status: 'pending' | 'generating' | 'ready' | 'failed';
  items: IBuildSummaryItem[];
}

export interface ICloneJob extends Document {
  ownerId: mongoose.Types.ObjectId;
  sourceUrl: string;
  projectName?: string;
  status: CloneJobStatus;
  currentStageLabel: string;
  progressPercent: number;
  crawlPages: ICrawlPage[];
  logs: ICloneJobLog[];
  buildSteps: IBuildStep[];
  previewSteps: IBuildStep[];
  factualSiteData?: Record<string, unknown>;
  businessProfile?: Record<string, unknown>;
  proposedWebsitePlan?: Record<string, unknown>;
  suggestedTemplate?: {
    category: string;
    variant: string;
    reason?: string;
    layoutStarterId?: string;
  };
  contentFidelity?: {
    passed: boolean;
    issues: string[];
    criticalIssues?: string[];
    warnIssues?: string[];
    hasCriticalFailures?: boolean;
  };
  generatedSiteValidation?: Record<string, unknown>;
  buildValidation?: IBuildValidation;
  deployment?: IDeployment;
  preview?: IPreview;
  previewSiteSpec?: Record<string, unknown>;
  technicalBuild?: ITechnicalBuild;
  buildSummary?: IBuildSummary;
  createdProjectId?: mongoose.Types.ObjectId;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CloneJobSchema = new Schema<ICloneJob>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sourceUrl: { type: String, required: true },
    projectName: { type: String },
    status: {
      type: String,
      enum: ['queued', 'crawling', 'extracting', 'planning', 'review_ready', 'preview_building', 'preview_ready', 'building', 'deploying', 'completed', 'failed'],
      default: 'queued',
    },
    currentStageLabel: { type: String, default: 'Preparing crawl...' },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    crawlPages: [{
      url: { type: String, required: true },
      title: String,
      status: { type: String, enum: ['queued', 'crawling', 'done', 'failed', 'skipped'], default: 'queued' },
      statusCode: Number,
      textLength: Number,
      error: String,
      startedAt: Date,
      completedAt: Date,
    }],
    logs: [{
      timestamp: { type: Date, default: Date.now },
      stage: String,
      message: String,
      data: Schema.Types.Mixed,
    }],
    buildSteps: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
      startedAt: Date,
      completedAt: Date,
      error: String,
    }],
    previewSteps: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
      startedAt: Date,
      completedAt: Date,
      error: String,
    }],
    factualSiteData: { type: Schema.Types.Mixed },
    businessProfile: { type: Schema.Types.Mixed },
    proposedWebsitePlan: { type: Schema.Types.Mixed },
    suggestedTemplate: {
      category: String,
      variant: String,
      reason: String,
      layoutStarterId: String,
    },
    contentFidelity: { type: Schema.Types.Mixed },
    generatedSiteValidation: { type: Schema.Types.Mixed },
    buildValidation: { type: Schema.Types.Mixed },
    deployment: { type: Schema.Types.Mixed },
    preview: { type: Schema.Types.Mixed },
    previewSiteSpec: { type: Schema.Types.Mixed },
    technicalBuild: { type: Schema.Types.Mixed },
    buildSummary: { type: Schema.Types.Mixed },
    createdProjectId: { type: Schema.Types.ObjectId, ref: 'WebsiteProject' },
    error: String,
  },
  { timestamps: true }
);

CloneJobSchema.index({ ownerId: 1, createdAt: -1 });
CloneJobSchema.index({ status: 1, updatedAt: 1 });

export const CloneJob = mongoose.models.CloneJob ?? mongoose.model<ICloneJob>('CloneJob', CloneJobSchema);

export const BUILD_STEPS = [
  { key: 'generate_site_spec', label: 'Preparing website structure' },
  { key: 'generate_files', label: 'Generating Next.js website files' },
  { key: 'validate_build', label: 'Running local build gate' },
  { key: 'create_gitlab_project', label: 'Creating GitLab repository' },
  { key: 'commit_files', label: 'Committing generated code' },
  { key: 'create_vercel_project', label: 'Creating Vercel project' },
  { key: 'trigger_deployment', label: 'Starting Vercel deployment' },
  { key: 'wait_for_vercel', label: 'Waiting for Vercel to finish building' },
] as const;

export const PREVIEW_STEPS = [
  { key: 'prepare_structure', label: 'Preparing website structure' },
  { key: 'create_homepage', label: 'Creating homepage' },
  { key: 'add_services', label: 'Adding services' },
  { key: 'add_about', label: 'Adding about section' },
  { key: 'add_contact', label: 'Adding contact section' },
  { key: 'apply_style', label: 'Applying visual style' },
  { key: 'quality_check', label: 'Checking website quality' },
  { key: 'start_preview', label: 'Starting preview server' },
] as const;

export const BUILD_SUMMARY_ITEMS = [
  { key: 'hero', label: 'Creating homepage hero' },
  { key: 'sections', label: 'Building website sections' },
  { key: 'services', label: 'Adding services' },
  { key: 'contact', label: 'Preparing contact section' },
  { key: 'style', label: 'Applying visual style' },
  { key: 'quality', label: 'Checking website quality' },
  { key: 'preview', label: 'Starting preview' },
] as const;
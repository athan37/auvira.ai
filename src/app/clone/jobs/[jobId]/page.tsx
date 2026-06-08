'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { websitePlanToReviewCard } from '@/lib/clone/planReviewAdapter';
import { isWebsitePlanShape } from '@/lib/clone/normalizeProposedPlan';
import ExtractedFactsCard from '@/components/clone/ExtractedFactsCard';
import CrawlProgressCard from '@/components/clone/CrawlProgressCard';
import ProposedPlanCard from '@/components/clone/ProposedPlanCard';
import ReviewChecklistCard from '@/components/clone/ReviewChecklistCard';
import BuildDeployProgressCard from '@/components/clone/BuildDeployProgressCard';
import CloneJobLogs from '@/components/clone/CloneJobLogs';
import CloneJobSuccessCard from '@/components/clone/CloneJobSuccessCard';
import PreviewChatCard from '@/components/clone/PreviewChatCard';
import LiveBuildSummaryCard from '@/components/clone/LiveBuildSummaryCard';
import { TemplateGalleryPicker } from '@/components/clone/TemplateGalleryPicker';
import { StarterGalleryPicker } from '@/components/scratch/StarterGalleryPicker';
import { CloneDeployInterstitial } from '@/components/clone/CloneDeployInterstitial';
import { PublishActions } from '@/components/owner/PublishActions';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/PageContainer';
import { LoadingShell } from '@/components/ui/LoadingShell';
import { Loading } from '@/components/ui/Loading';
import { ACCENT, BORDER, SURFACE, TEXT } from '@/content/productTheme';
import { cn } from '@/lib/cn';
import Link from 'next/link';
import type { TemplateGalleryEntry } from '@/lib/builder/templateGallery';
import { getLayoutStarter, type LayoutStarter, type LayoutStarterId } from '@/lib/builder/layoutStarters';
import { getClonePreviewProjectPath } from '@/lib/clone/cloneBuildPreviewResponse';

interface CrawlPage {
  url: string;
  title?: string;
  status: 'queued' | 'crawling' | 'done' | 'failed' | 'skipped';
  statusCode?: number;
  textLength?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Log {
  timestamp: string;
  stage: string;
  message: string;
}

interface BuildStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface Deployment {
  provider: string;
  status: string;
  ready: boolean;
  vercelProjectId?: string;
  vercelProjectName?: string;
  expectedProductionUrl?: string;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  note?: string;
  error?: string;
}

interface Preview {
  status: 'not_started' | 'building' | 'ready' | 'failed' | 'stopped';
  url?: string;
  port?: number;
  startedAt?: string;
  error?: string;
}

interface BuildSummaryItem {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  summary?: string;
  data?: {
    title?: string;
    count?: number;
    examples?: string[];
  };
}

interface BuildSummary {
  status: 'pending' | 'generating' | 'ready' | 'failed';
  items: BuildSummaryItem[];
}

interface TechnicalBuild {
  workspacePath?: string;
  files?: Array<{ path: string; status: string }>;
  validationLogs?: string;
}

interface ExtractedFactsSummary {
  businessName?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  services?: string[];
  serviceArea?: string | null;
  hours?: string[] | null;
  socialLinks?: string[];
  contactLinks?: string[];
  bookingLinks?: string[];
}

interface ProposedWebsitePlan {
  siteTitle?: string;
  tagline?: string;
  primaryCTA?: string;
  secondaryCTA?: string;
  positioningStatement?: string;
  sections?: Array<{ type: string; title?: string; description?: string; purpose?: string }>;
}

interface SuggestedTemplate {
  category: string;
  variant: string;
  reason?: string;
  layoutStarterId?: string;
}

interface ReviewChecklist {
  businessNameFound: boolean;
  contactInfoFound: boolean;
  servicesFound: boolean;
  sectionsFound: boolean;
  requiredWarnings: string[];
  optionalWarnings: string[];
}

interface ContentFidelity {
  passed: boolean;
  issues: string[];
  criticalIssues?: string[];
  warnIssues?: string[];
  hasCriticalFailures?: boolean;
}

interface CloneJob {
  id: string;
  sourceUrl: string;
  projectName?: string;
  status: string;
  currentStageLabel: string;
  progressPercent: number;
  elapsedSeconds: number;
  secondsAgo: number;
  crawlSummary?: {
    totalDiscovered: number;
    totalCrawled: number;
    totalSkipped: number;
    totalFailed: number;
  };
  crawlPages: CrawlPage[];
  extractedFactsSummary?: ExtractedFactsSummary | null;
  proposedWebsitePlan?: ProposedWebsitePlan | null;
  suggestedTemplate?: SuggestedTemplate | null;
  contentFidelity?: ContentFidelity | null;
  reviewChecklist?: ReviewChecklist | null;
  buildSteps: BuildStep[];
  previewSteps?: BuildStep[];
  buildSummary?: BuildSummary | null;
  deployment?: Deployment | null;
  preview?: Preview | null;
  previewSiteSpec?: Record<string, unknown> | null;
  technicalBuild?: TechnicalBuild | null;
  gitlab?: { repoUrl?: string; webUrl?: string } | null;
  error?: string;
  createdProjectId?: string;
  logs: Log[];
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  queued: 'We are preparing to read your existing website.',
  crawling: 'We are reading public pages from your existing website.',
  extracting: 'We are identifying business facts like services, contact info, and location.',
  planning: 'We are turning the discovered facts into a proposed website structure.',
  review_ready: 'Review the proposed plan below. When you approve, we will build a preview.',
  preview_building: 'We are building a preview of your new website.',
  preview_ready: 'Your preview is ready! Review your website and chat to make changes before deploying.',
  building: 'We are generating a Next.js site and checking that it builds locally.',
  deploying: 'We are starting a Vercel deployment and waiting until it is live.',
  completed: 'Your website is live and ready to visit.',
  failed: 'Something went wrong. See error details below.',
};

const NEXT_PHASE: Record<string, string> = {
  queued: 'Crawl public website pages',
  crawling: 'Extract business facts',
  extracting: 'Prepare proposed website plan',
  planning: 'Review and approve plan',
  review_ready: 'Build preview website',
  preview_building: 'Generating your preview',
  preview_ready: 'Deploy website to Vercel',
  building: 'Create GitLab repository and deployment',
  deploying: 'Wait for Vercel to finish building',
  completed: 'Open website or workspace',
  failed: 'Review error and retry',
};

const BLOCKING_FIELDS = ['businessName'];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: cn(SURFACE.alt, TEXT.muted),
    crawling: 'bg-rose-50 text-rose-700',
    extracting: 'bg-rose-50 text-rose-700',
    planning: 'bg-amber-50 text-amber-800',
    review_ready: 'bg-emerald-50 text-emerald-800',
    preview_building: 'bg-rose-50 text-rose-700',
    preview_ready: 'bg-rose-50 text-rose-700',
    building: 'bg-rose-50 text-rose-700',
    deploying: 'bg-rose-50 text-rose-700',
    completed: 'bg-emerald-50 text-emerald-800',
    failed: 'bg-red-50 text-red-700',
  };
  return (
    <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', colors[status] || cn(SURFACE.alt, TEXT.muted))}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatSecondsAgo(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function CloneJobPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<CloneJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [showDeployInterstitial, setShowDeployInterstitial] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ category: string; variant: string } | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<LayoutStarterId | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/clone/jobs/${jobId}`);
      const data = await res.json();
      if (data.ok) {
        setJob(data.job);
        setLoading(false);
        return data.job;
      } else {
        setError(data.message || 'Failed to load job');
        setLoading(false);
        return null;
      }
    } catch {
      setError('Network error');
      setLoading(false);
      return null;
    }
  }, [jobId]);

  // Initial load + start process if queued
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') { router.push('/auth/signin'); return; }
    if (sessionStatus !== 'authenticated') return;

    fetchJob().then((j) => {
      if (j?.status === 'queued' && !processing) {
        startProcess();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  // Poll while in progress
  useEffect(() => {
    if (!job) return;
    if (['queued', 'crawling', 'extracting', 'planning', 'preview_building', 'preview_ready', 'building', 'deploying', 'ready'].includes(job.status)) {
      const interval = setInterval(fetchJob, 2000);
      return () => clearInterval(interval);
    }
  }, [job, fetchJob]);

  // Post-deploy interstitial (10s) before editor redirect
  useEffect(() => {
    if (!job) return;
    const isReady =
      job.status === 'completed' ||
      job.deployment?.ready === true ||
      job.deployment?.status === 'ready';
    if (isReady && job.createdProjectId) {
      setShowDeployInterstitial(true);
    }
  }, [job]);

  const startProcess = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await fetch('/api/projects/clone/jobs/' + jobId + '/process', { method: 'POST' });
      await fetchJob();
    } finally {
      setProcessing(false);
    }
  };

  const handleTemplateSelect = async (entry: TemplateGalleryEntry) => {
    setSelectedTemplate({ category: entry.category, variant: entry.variant });
    try {
      await fetch(`/api/projects/clone/jobs/${jobId}/set-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: entry.category,
          variant: entry.variant,
        }),
      });
      await fetchJob();
    } catch {
      setError('Failed to save template selection');
    }
  };

  const handleLayoutSelect = async (starter: LayoutStarter) => {
    setSelectedLayoutId(starter.id);
    try {
      await fetch(`/api/projects/clone/jobs/${jobId}/set-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutStarterId: starter.id }),
      });
      await fetchJob();
    } catch {
      setError('Failed to save layout selection');
    }
  };

  const handleApproveBuild = async () => {
    if (!job || job.status !== 'review_ready') return;
    setApproving(true);
    try {
      const buildRes = await fetch('/api/projects/clone/jobs/' + jobId + '/build-preview', { method: 'POST' });
      const buildData = await buildRes.json();
      if (!buildRes.ok || !buildData.ok) {
        setError(buildData.error || 'Failed to build preview');
      } else {
        const projectPath = getClonePreviewProjectPath(buildData);
        if (projectPath) {
          router.replace(projectPath);
          return;
        }
      }
      await fetchJob();
    } catch {
      setError('Network error');
    } finally {
      setApproving(false);
    }
  };

  const handleRevisePlan = async () => {
    if (!job || !revisionNote.trim()) return;
    setRevising(true);
    try {
      const res = await fetch('/api/projects/clone/jobs/' + jobId + '/revise-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: revisionNote }),
      });
      const data = await res.json();
      if (data.ok) {
        setRevisionNote('');
        setShowRevisionInput(false);
        await fetchJob();
      } else {
        setError(data.error || 'Revision failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setRevising(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return <LoadingShell message="Loading clone job…" />;
  }

  if (error || !job) {
    return (
      <AppShell variant="minimal">
        <PageContainer narrow className="py-24 text-center">
          <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
          <Link href="/dashboard" className={cn('hover:underline text-sm', ACCENT.link)}>
            ← Back to Dashboard
          </Link>
        </PageContainer>
      </AppShell>
    );
  }

  const isInProgress = ['queued', 'crawling', 'extracting', 'planning'].includes(job.status);
  const isReviewReady = job.status === 'review_ready';
  const isPreviewBuilding = job.status === 'preview_building';
  const isPreviewReady = job.status === 'preview_ready';
  const isBuilding = job.status === 'building';
  const isDeploying = job.status === 'deploying';
  const isDone = job.status === 'completed' || (job.deployment?.ready === true && job.status !== 'deploying');
  const isFailed = job.status === 'failed';

  const phaseDesc = PHASE_DESCRIPTIONS[job.status] || '';
  const elapsedStr = formatElapsed(job.elapsedSeconds);
  const updatedStr = job.secondsAgo !== undefined ? formatSecondsAgo(job.secondsAgo) : '';

  return (
    <AppShell
      variant="minimal"
      breadcrumb={
        <span className="truncate max-w-[200px] sm:max-w-xs">
          {job.projectName || new URL(job.sourceUrl).hostname}
        </span>
      }
      actions={<StatusBadge status={job.status} />}
    >
      <PageContainer className="py-6">
        <Card variant="glass" className="p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Link href="/dashboard" className={cn('text-sm shrink-0', TEXT.muted, 'hover:text-[#1d1d1f]')}>
              ← Dashboard
            </Link>
            <div className={cn('text-xs', TEXT.tertiary)}>
              {elapsedStr} · {updatedStr}
            </div>
          </div>
          <div className="w-full bg-[#d2d2d7]/60 rounded-full h-1.5">
            <div
              className="bg-rose-gradient h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className={cn('text-xs', TEXT.muted)}>{job.currentStageLabel}</span>
            <span className={cn('text-xs', TEXT.tertiary)}>{job.progressPercent}%</span>
          </div>
        </Card>

      {phaseDesc && (
        <div className={cn(SURFACE.alt, 'border rounded-2xl px-4 py-3 mb-6', BORDER.hairline)}>
          <div className="flex items-start gap-4">
            <p className={cn('text-xs flex-1', TEXT.primary)}>{phaseDesc}</p>
            {NEXT_PHASE[job.status] && job.status !== 'completed' && job.status !== 'failed' && (
              <p className={cn('text-xs flex-shrink-0', TEXT.muted)}>Next: {NEXT_PHASE[job.status]}</p>
            )}
          </div>
        </div>
      )}

      <div>
        {/* Error state */}
        {isFailed && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 font-medium">Clone failed</p>
            <p className="text-red-600 text-sm mt-1">{job.error || 'Unknown error'}</p>
            <a href="/projects/new/clone" className="text-sm text-red-700 hover:underline mt-2 inline-block">← Try again</a>
          </div>
        )}

        {/* Success / interstitial */}
        {isDone && showDeployInterstitial && job.createdProjectId && (
          <CloneDeployInterstitial
            liveUrl={job.deployment?.liveUrl}
            projectId={job.createdProjectId}
            onContinue={() => router.push(`/projects/${job.createdProjectId}`)}
          />
        )}

        {isDone && !showDeployInterstitial && (
          <div className="mb-4">
            <CloneJobSuccessCard
              createdProjectId={job.createdProjectId || ''}
              deployment={job.deployment}
              gitlab={job.gitlab}
              suggestedTemplate={job.suggestedTemplate}
            />
          </div>
        )}

        {/* Two column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT COLUMN — Information (3/5) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Crawl progress */}
            {job.crawlPages.length > 0 && (
              <CrawlProgressCard
                crawlPages={job.crawlPages}
                crawlSummary={job.crawlSummary || { totalDiscovered: job.crawlPages.length, totalCrawled: 0, totalSkipped: 0, totalFailed: 0 }}
                stageLabel={job.currentStageLabel}
                elapsedFormatted={elapsedStr}
              />
            )}

            {/* Extracted facts — show as soon as any field exists */}
            {job.extractedFactsSummary && (
              <ExtractedFactsCard facts={job.extractedFactsSummary} phase={job.status} />
            )}

            {/* Proposed plan */}
            {job.proposedWebsitePlan && (
              <ProposedPlanCard
                plan={
                  isWebsitePlanShape(job.proposedWebsitePlan)
                    ? websitePlanToReviewCard(job.proposedWebsitePlan)
                    : job.proposedWebsitePlan
                }
                suggestedTemplate={job.suggestedTemplate}
              />
            )}

            {/* Logs — collapsed by default */}
            {job.logs.length > 0 && (
              <CloneJobLogs logs={job.logs} defaultOpen={isFailed} />
            )}
          </div>

          {/* RIGHT COLUMN — Actions (2/5) */}
          <div className="lg:col-span-2 space-y-4">
            {isReviewReady && job.suggestedTemplate && (
              <div className={cn('bg-white rounded-2xl border p-4 space-y-4', BORDER.hairline)}>
                <StarterGalleryPicker
                  selectedId={
                    selectedLayoutId ??
                    getLayoutStarter(job.suggestedTemplate.layoutStarterId)?.id ??
                    null
                  }
                  onSelect={handleLayoutSelect}
                  disabled={approving}
                  industry={job.extractedFactsSummary?.industry || ''}
                />
                <TemplateGalleryPicker
                  selectedCategory={selectedTemplate?.category || job.suggestedTemplate.category}
                  selectedVariant={selectedTemplate?.variant || job.suggestedTemplate.variant}
                  onSelect={handleTemplateSelect}
                  disabled={approving}
                  description="Change your color theme before building the preview. Content comes from your existing site."
                />
              </div>
            )}

            {/* Review checklist + approval */}
            {isReviewReady && job.reviewChecklist && (() => {
              const checklist = job.reviewChecklist;
              const blocking: string[] = [];
              if (!checklist.businessNameFound) {
                blocking.push('Business name not found. Without it we cannot generate an accurate site.');
              }
              const hasBlocking = blocking.length > 0;
              const hasWarnings = checklist.requiredWarnings.length > 0 || checklist.optionalWarnings.length > 0;
              const confidenceMessage = hasBlocking
                ? 'Some required information is missing. Please resolve the blocking issues before building.'
                : hasWarnings
                ? 'We can build a first version, but please review the warnings below.'
                : 'We found enough information to build a first version.';

              return (
                <ReviewChecklistCard
                  checklist={checklist}
                  contentFidelity={job.contentFidelity}
                  confidenceMessage={confidenceMessage}
                  blockingIssues={blocking}
                />
              );
            })()}

            {/* Revise plan input */}
            {isReviewReady && showRevisionInput && (
              <div className={cn('bg-white rounded-2xl border overflow-hidden', BORDER.hairline)}>
                <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50">
                  <h2 className="font-medium text-yellow-800 text-sm">Revise Plan</h2>
                  <p className="text-xs text-yellow-600 mt-0.5">Tell us how to improve the proposed plan</p>
                </div>
                <div className="p-4 space-y-3">
                  <textarea
                    value={revisionNote}
                    onChange={e => setRevisionNote(e.target.value)}
                    placeholder='e.g. "Make it more premium", "Emphasize emergency service", "Add a pricing section"'
                    className={cn('w-full text-sm border rounded-xl p-2 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500/35', BORDER.hairline)}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRevisePlan}
                      disabled={revising || !revisionNote.trim()}
                      variant="primary"
                      className="flex-1"
                    >
                      {revising ? 'Revising...' : 'Apply Revision'}
                    </Button>
                    <Button
                      onClick={() => setShowRevisionInput(false)}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Revise plan button (review_ready only) */}
            {isReviewReady && !showRevisionInput && (
              <Button
                onClick={() => setShowRevisionInput(true)}
                variant="glass"
                className="w-full"
              >
                Revise Plan
              </Button>
            )}

            {/* Build/deploy progress */}
            {(isBuilding || isDeploying) && job.buildSteps.length > 0 && (
              <BuildDeployProgressCard
                status={job.status}
                buildSteps={job.buildSteps}
                deployment={job.deployment}
                stageLabel={job.currentStageLabel}
              />
            )}

            {/* Review ready — approval buttons */}
            {isReviewReady && job.reviewChecklist && (() => {
              const hasBlocking = !job.reviewChecklist.businessNameFound;
              return (
              <div className={cn('bg-white rounded-2xl border overflow-hidden', BORDER.hairline)}>
                <div className="px-4 py-3 border-t-4 border-rose-500">
                  <div className="space-y-2">
                    <Button
                      onClick={handleApproveBuild}
                      disabled={approving || hasBlocking}
                      variant="primary"
                      className="w-full"
                      size="lg"
                    >
                      {approving ? 'Building preview...' : 'Build Preview'}
                    </Button>
                    <Button
                      onClick={() => router.push('/dashboard')}
                      variant="ghost"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* In progress spinner */}
            {isInProgress && !isReviewReady && (
              <div className={cn('bg-white rounded-2xl border p-6 text-center', BORDER.hairline)}>
                <Loading size="md" className="mx-auto mb-4" />
                <p className={cn('text-sm', TEXT.muted)}>{job.currentStageLabel}</p>
                <p className={cn('text-xs mt-1', TEXT.tertiary)}>You can keep this page open to watch progress. If you leave, you can return from your dashboard.</p>
              </div>
            )}

            {/* Live Build Summary — shown during preview_building */}
            {(isPreviewBuilding) && (
              <LiveBuildSummaryCard buildSummary={job.buildSummary} status={job.status} />
            )}

            {/* Building spinner */}
            {isBuilding && (
              <div className={cn('bg-white rounded-2xl border p-6 text-center', BORDER.hairline)}>
                <Loading size="md" className="mx-auto mb-4" />
                <p className={cn('text-sm', TEXT.muted)}>{job.currentStageLabel}</p>
                <p className={cn('text-xs mt-1', TEXT.tertiary)}>Building takes 1-3 min.</p>
              </div>
            )}

            {/* Deploying — preview stays live */}
            {isDeploying && (
              <div className={cn('bg-white rounded-2xl border p-6 text-center', BORDER.hairline)}>
                <Loading size="md" className="mx-auto mb-4" />
                <p className={cn('text-sm', TEXT.muted)}>{job.currentStageLabel}</p>
                <p className={cn('text-xs mt-1', TEXT.tertiary)}>Your preview is still available while we publish the website.</p>
                {job.preview?.url && (
                  <a
                    href={job.preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-block mt-2 text-xs hover:underline', ACCENT.link)}
                  >
                    View preview →
                  </a>
                )}
              </div>
            )}

            {/* Preview building spinner */}
            {isPreviewBuilding && (
              <div className={cn('bg-white rounded-2xl border p-6 text-center', BORDER.hairline)}>
                <Loading size="md" className="mx-auto mb-4" />
                <p className={cn('text-sm', TEXT.muted)}>{job.currentStageLabel}</p>
                <p className={cn('text-xs mt-1', TEXT.tertiary)}>This takes 1-2 minutes. You can keep this page open.</p>
              </div>
            )}

            {/* Preview ready — iframe + chat + deploy */}
            {isPreviewReady && job.preview && (
              <div className="space-y-3">
                {/* Live Build Summary — all done when preview_ready */}
                <LiveBuildSummaryCard buildSummary={job.buildSummary} status={job.status} />

                {/* Preview banner */}
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-rose-700 font-semibold text-sm">Preview is ready!</span>
                  </div>
                  <p className="text-xs text-rose-800">
                    This is your draft preview on this device — not your live website yet. Publish when ready.
                  </p>
                </div>

                {!job.preview.url && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-medium">Preview not available in the cloud app</p>
                    <p className="text-xs mt-1 text-amber-900">
                      Your site files passed checks. Use <strong>Deploy</strong> below to build on Vercel, or run{' '}
                      <code className="text-[11px]">npm run dev</code> locally to preview before deploying.
                    </p>
                  </div>
                )}

                {/* Preview iframe */}
                {job.preview.url && (
                  <div className={cn('rounded-2xl overflow-hidden border bg-white', BORDER.hairline)}>
                    <div className={cn('px-3 py-1.5 border-b flex items-center justify-between', SURFACE.alt, BORDER.hairline)}>
                      <span className={cn('text-xs', TEXT.muted)}>Website preview</span>
                      <a
                        href={job.preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('text-xs hover:underline', ACCENT.link)}
                      >
                        Open in new tab →
                      </a>
                    </div>
                    <iframe
                      src={job.preview.url}
                      className="w-full h-80"
                      title="Website preview"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Chat to edit */}
                <PreviewChatCard jobId={jobId} previewUrl={job.preview.url || ''} />

                {/* Save to GitLab (persist without Vercel) */}
                <PublishActions
                  mode="clone"
                  targetId={jobId}
                  createdProjectId={job.createdProjectId}
                  gitlabWebUrl={job.gitlab?.webUrl || job.gitlab?.repoUrl}
                  deploymentStatus={job.deployment?.status}
                  onSaveSuccess={() => fetchJob()}
                  onDeploySuccess={() => fetchJob()}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      </PageContainer>
    </AppShell>
  );
}
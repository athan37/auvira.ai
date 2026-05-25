'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import CrawlProgressCard from '@/components/clone/CrawlProgressCard';
import ExtractedFactsCard from '@/components/clone/ExtractedFactsCard';
import ProposedPlanCard from '@/components/clone/ProposedPlanCard';
import ReviewChecklistCard from '@/components/clone/ReviewChecklistCard';
import BuildDeployProgressCard from '@/components/clone/BuildDeployProgressCard';
import CloneJobLogs from '@/components/clone/CloneJobLogs';
import CloneJobSuccessCard from '@/components/clone/CloneJobSuccessCard';
import PreviewChatCard from '@/components/clone/PreviewChatCard';
import LiveBuildSummaryCard from '@/components/clone/LiveBuildSummaryCard';
import { TemplateGalleryPicker } from '@/components/clone/TemplateGalleryPicker';
import { CloneDeployInterstitial } from '@/components/clone/CloneDeployInterstitial';
import { PublishActions } from '@/components/owner/PublishActions';
import type { TemplateGalleryEntry } from '@/lib/builder/templateGallery';

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
    queued: 'bg-gray-100 text-gray-600',
    crawling: 'bg-blue-100 text-blue-700',
    extracting: 'bg-purple-100 text-purple-700',
    planning: 'bg-yellow-100 text-yellow-700',
    review_ready: 'bg-green-100 text-green-700',
    preview_building: 'bg-indigo-100 text-indigo-700',
    preview_ready: 'bg-indigo-100 text-indigo-700',
    building: 'bg-indigo-100 text-indigo-700',
    deploying: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
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
          reason: 'Selected by owner',
        }),
      });
      await fetchJob();
    } catch {
      setError('Failed to save template selection');
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading clone job...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Job not found'}</p>
          <a href="/dashboard" className="text-indigo-600 hover:underline">← Back to Dashboard</a>
        </div>
      </div>
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
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white/95 backdrop-blur border-b border-zinc-200/80 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <a href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-950 shrink-0">
                ← Dashboard
              </a>
              <h1 className="text-base font-semibold text-zinc-900 truncate max-w-[200px] sm:max-w-xs">
                {job.projectName || new URL(job.sourceUrl).hostname}
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-xs text-zinc-400">
              {elapsedStr} · {updatedStr}
            </div>
          </div>

          <div className="w-full bg-zinc-200 rounded-full h-1.5">
            <div
              className="bg-zinc-950 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-zinc-600">{job.currentStageLabel}</span>
            <span className="text-xs text-zinc-400">{job.progressPercent}%</span>
          </div>
        </div>
      </header>

      {phaseDesc && (
        <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-start gap-4">
            <p className="text-xs text-zinc-700 flex-1">{phaseDesc}</p>
            {NEXT_PHASE[job.status] && job.status !== 'completed' && job.status !== 'failed' && (
              <p className="text-xs text-zinc-500 flex-shrink-0">Next: {NEXT_PHASE[job.status]}</p>
            )}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
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
                plan={job.proposedWebsitePlan}
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
              <div className="bg-white rounded-xl border border-gray-200 p-4">
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
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-yellow-50">
                  <h2 className="font-medium text-yellow-800 text-sm">Revise Plan</h2>
                  <p className="text-xs text-yellow-600 mt-0.5">Tell us how to improve the proposed plan</p>
                </div>
                <div className="p-4 space-y-3">
                  <textarea
                    value={revisionNote}
                    onChange={e => setRevisionNote(e.target.value)}
                    placeholder='e.g. "Make it more premium", "Emphasize emergency service", "Add a pricing section"'
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRevisePlan}
                      disabled={revising || !revisionNote.trim()}
                      className="flex-1 bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                    >
                      {revising ? 'Revising...' : 'Apply Revision'}
                    </button>
                    <button
                      onClick={() => setShowRevisionInput(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Revise plan button (review_ready only) */}
            {isReviewReady && !showRevisionInput && (
              <button
                onClick={() => setShowRevisionInput(true)}
                className="w-full bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Revise Plan
              </button>
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
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-t-4 border-green-500">
                  <div className="space-y-2">
                    <button
                      onClick={handleApproveBuild}
                      disabled={approving || hasBlocking}
                      className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {approving ? 'Building preview...' : 'Build Preview'}
                    </button>
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* In progress spinner */}
            {isInProgress && !isReviewReady && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">{job.currentStageLabel}</p>
                <p className="text-gray-400 text-xs mt-1">You can keep this page open to watch progress. If you leave, you can return from your dashboard.</p>
              </div>
            )}

            {/* Live Build Summary — shown during preview_building */}
            {(isPreviewBuilding) && (
              <LiveBuildSummaryCard buildSummary={job.buildSummary} status={job.status} />
            )}

            {/* Building spinner */}
            {isBuilding && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">{job.currentStageLabel}</p>
                <p className="text-gray-400 text-xs mt-1">Building takes 1-3 min.</p>
              </div>
            )}

            {/* Deploying — preview stays live */}
            {isDeploying && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">{job.currentStageLabel}</p>
                <p className="text-gray-400 text-xs mt-1">Your preview is still available while we publish the website.</p>
                {job.preview?.url && (
                  <a
                    href={job.preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-indigo-600 hover:underline"
                  >
                    View preview →
                  </a>
                )}
              </div>
            )}

            {/* Preview building spinner */}
            {isPreviewBuilding && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">{job.currentStageLabel}</p>
                <p className="text-gray-400 text-xs mt-1">This takes 1-2 minutes. You can keep this page open.</p>
              </div>
            )}

            {/* Preview ready — iframe + chat + deploy */}
            {isPreviewReady && job.preview && (
              <div className="space-y-3">
                {/* Live Build Summary — all done when preview_ready */}
                <LiveBuildSummaryCard buildSummary={job.buildSummary} status={job.status} />

                {/* Preview banner */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-indigo-600 font-semibold text-sm">Preview is ready!</span>
                  </div>
                  <p className="text-xs text-indigo-700">
                    This is your draft preview on this device — not your live website yet. Publish when ready.
                  </p>
                </div>

                {/* Preview iframe */}
                {job.preview.url && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                    <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Website preview</span>
                      <a
                        href={job.preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
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
      </main>
    </div>
  );
}
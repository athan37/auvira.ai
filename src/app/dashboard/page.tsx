'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { OwnerGettingStartedChecklist } from '@/components/owner/OwnerGettingStartedChecklist';
import { Alert } from '@/components/ui/Alert';
import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/PageContainer';
import { LoadingShell } from '@/components/ui/LoadingShell';
import { ACCENT, TEXT } from '@/content/productTheme';

/** Dev only — set `true` to preview LoadingShell on /dashboard. Revert before commit. */
const DEV_PREVIEW_LOADING = false;

interface Project {
  id: string;
  name: string;
  mode: 'clone' | 'scratch';
  sourceUrl?: string;
  siteTitle?: string;
  deploymentStatus?: string;
  liveUrl?: string | null;
  status: string;
  hasUnpublishedChanges?: boolean;
  updatedAt: string;
  lastEditedAt?: string;
}

interface ActiveCloneJob {
  id: string;
  sourceUrl: string;
  projectName?: string;
  status: string;
  currentStageLabel: string;
  progressPercent: number;
  continueUrl: string;
}

function ProjectCard({ project }: { project: Project }) {
  const status = project.deploymentStatus || project.status;
  const tone = statusToBadgeTone(status);
  const vercelTriggerFailed = project.deploymentStatus === 'trigger_failed';

  return (
    <Card variant="bright" className="p-5 hover:shadow-glass transition-all h-full flex flex-col">
      <Link href={`/projects/${project.id}`} className="flex-1 block">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-[#1d1d1f] text-lg truncate">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge tone={tone}>{status}</Badge>
              {project.hasUnpublishedChanges && <Badge tone="warning">Unpublished edits</Badge>}
            </div>
          </div>
          <span className="text-xs text-[#86868b] capitalize shrink-0">{project.mode}</span>
        </div>
        {vercelTriggerFailed && (
          <Alert variant="warning" className="mb-2 text-xs">
            Vercel deployment was not triggered. Open the project to retry publish or check GitLab/Vercel setup.
          </Alert>
        )}
        {project.siteTitle && (
          <p className="text-sm text-[#6e6e73] mb-2 line-clamp-2">{project.siteTitle}</p>
        )}
        {project.sourceUrl && (
          <p className="text-xs text-[#86868b] truncate">Source: {project.sourceUrl}</p>
        )}
      </Link>
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-[#d2d2d7]/60 text-xs">
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ACCENT.link} hover:underline font-medium`}
          >
            Live site →
          </a>
        )}
        <span className="text-[#86868b] ml-auto">
          {new Date(project.lastEditedAt || project.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}

function ActiveCloneJobCard({ job }: { job: ActiveCloneJob }) {
  return (
    <Card variant="bright" className="p-4 border-blue-200/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#1d1d1f] truncate">
            {job.projectName || job.sourceUrl}
          </p>
          <p className="text-xs text-[#6e6e73] mt-0.5">{job.currentStageLabel}</p>
          <div className="mt-2 w-full bg-[#d2d2d7]/60 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full"
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
        </div>
        <Badge tone="info">{job.status.replace(/_/g, ' ')}</Badge>
      </div>
      <Link href={job.continueUrl} className="inline-block mt-3">
        <Button size="sm" variant="secondary">
          Continue setup
        </Button>
      </Link>
    </Card>
  );
}

function DashboardContent() {
  const { status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveCloneJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setLoading(status === 'loading');
      return;
    }
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/projects/clone/jobs/active').then((r) => r.json()),
    ])
      .then(([projectsData, jobsData]) => {
        if (projectsData.ok) setProjects(projectsData.projects);
        else setError(projectsData.error || 'Failed to load projects');
        if (jobsData.ok) setActiveJobs(jobsData.jobs);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load dashboard');
        setLoading(false);
      });
  }, [status]);

  if (DEV_PREVIEW_LOADING || loading || status !== 'authenticated') {
    return <LoadingShell message="Loading dashboard…" />;
  }

  if (error) {
    return (
      <PageContainer className="py-12">
        <p className="text-red-600 text-center">{error}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">Your websites</h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            {projects.length} site{projects.length !== 1 ? 's' : ''} — describe, preview, publish
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/projects/new/scratch">
            <Button variant="secondary">Start with a prompt</Button>
          </Link>
          <Link href="/projects/new/clone">
            <Button>Refresh from URL</Button>
          </Link>
        </div>
      </div>

      <OwnerGettingStartedChecklist context="dashboard" className="mb-6" />

      {activeJobs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#1d1d1f] mb-3">In progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeJobs.map((job) => (
              <ActiveCloneJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Card variant="bright">
          <EmptyState
            title="No websites yet"
            description="Describe your business or paste an existing URL — Auvira.ai builds the draft for you."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/projects/new/scratch">
                  <Button>Start with a prompt</Button>
                </Link>
                <Link href="/projects/new/clone">
                  <Button variant="secondary">Refresh from URL</Button>
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
  }, [status, router]);

  if (DEV_PREVIEW_LOADING || status === 'loading') {
    return <LoadingShell message="Loading dashboard…" />;
  }

  if (status === 'unauthenticated') {
    return <LoadingShell message="Redirecting to sign in…" />;
  }

  return (
    <AppShell variant="default" title="Dashboard">
      <DashboardContent />
    </AppShell>
  );
}

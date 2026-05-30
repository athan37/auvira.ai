'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectPreviewFrame } from '@/components/ProjectPreviewFrame';
import {
  schedulePreviewIframeReloads,
  workspaceEditNeedsPreviewReload,
} from '@/lib/project-workspace/previewReloadAfterEdit';
import { ProjectEditorSidebar } from '@/components/project/ProjectEditorSidebar';
import { UnpublishedChangesBadge } from '@/components/UnpublishedChangesBadge';
import { ownerProjectStatusLabel } from '@/lib/owner/ownerCopy';
import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

interface Deployment {
  provider: string;
  status: string;
  ready?: boolean;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  vercelProjectName?: string;
  deployHookId?: string;
  deployTriggered?: boolean;
  triggeredAt?: string;
  note?: string;
  error?: string;
}

interface Project {
  id: string;
  mode: 'clone' | 'scratch';
  name: string;
  siteSpec: Record<string, unknown>;
  gitlab?: {
    projectId: number;
    repoUrl: string;
    webUrl?: string;
  };
  deployment?: Deployment | null;
  status: string;
  hasUnpublishedChanges?: boolean;
  needsSave?: boolean;
  hasLocalGitChanges?: boolean;
  lastPreviewEditedAt?: string;
  lastPublishedAt?: string;
  codeWorkspace?: {
    status: 'not_started' | 'ready' | 'editing' | 'failed';
    version: number;
  };
}

export default function ProjectPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestJobId, setLatestJobId] = useState<string | null>(null);
  const [diffRefreshKey, setDiffRefreshKey] = useState(0);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [editInProgress, setEditInProgress] = useState(false);
  const [scratchWarning, setScratchWarning] = useState<string | null>(null);
  const previewReloadCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      const key = `project-warning-${projectId}`;
      const warning = sessionStorage.getItem(key);
      if (warning) {
        setScratchWarning(warning);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [projectId]);

  useEffect(() => {
    return () => {
      previewReloadCancelRef.current?.();
    };
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.ok) {
        setProject(data.project);
        setLoading(false);
        return data.project;
      }
      setError(data.message || 'Failed to load project');
      setLoading(false);
      return null;
    } catch {
      setError('Network error');
      setLoading(false);
      return null;
    }
  }, [projectId]);

  const handlePreviewReadyChange = useCallback((ready: boolean) => {
    setPreviewReady(ready);
  }, []);

  const handleDeploySuccess = useCallback(() => {
    fetchProject();
    setDiffRefreshKey((k) => k + 1);
  }, [fetchProject]);

  const devBypassAuth =
    process.env.NEXT_PUBLIC_SITE_AGENT_DEV_BYPASS_AUTH === '1' &&
    process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!devBypassAuth && sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router, devBypassAuth]);

  useEffect(() => {
    if ((devBypassAuth || sessionStatus === 'authenticated') && projectId) {
      fetchProject();
    }
  }, [sessionStatus, projectId, fetchProject, devBypassAuth]);

  if ((!devBypassAuth && sessionStatus === 'loading') || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Spinner />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
          <Link href="/dashboard" className="text-zinc-950 hover:underline text-sm">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      variant="editor"
      breadcrumb={
        <span className="truncate">
          <Link href="/dashboard" className="hover:text-zinc-800">
            Dashboard
          </Link>
          <span className="mx-1">/</span>
          {project.name}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {(project.needsSave ?? project.hasUnpublishedChanges) && (
            <UnpublishedChangesBadge hasUnpublishedChanges />
          )}
          <Badge tone={statusToBadgeTone(project.status)}>
            {ownerProjectStatusLabel(project.status, project.deployment?.status)}
          </Badge>
          {project.gitlab?.webUrl && (
            <a
              href={project.gitlab.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-950 hidden sm:inline"
            >
              Backup (advanced)
            </a>
          )}
        </div>
      }
    >
      {scratchWarning && (
        <div className="px-3 lg:px-4 pt-3">
          <Alert variant="warning">{scratchWarning}</Alert>
        </div>
      )}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 h-[calc(100vh-3.5rem)] p-3 lg:p-4 gap-3 lg:gap-4">
        <div className="flex-1 min-h-[320px] lg:min-h-0 min-w-0 flex flex-col">
          <ProjectPreviewFrame
            projectId={projectId}
            codeWorkspaceVersion={project.codeWorkspace?.version}
            previewRefreshKey={previewRefreshKey}
            onReadyChange={handlePreviewReadyChange}
          />
        </div>

        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 min-h-[400px] lg:min-h-0 flex flex-col">
          <ProjectEditorSidebar
            projectId={projectId}
            previewReady={previewReady}
            needsSave={project.needsSave ?? project.hasUnpublishedChanges}
            hasGitlab={Boolean(project.gitlab?.repoUrl)}
            gitlabWebUrl={project.gitlab?.webUrl || project.gitlab?.repoUrl}
            latestJobId={latestJobId}
            diffRefreshKey={diffRefreshKey}
            editInProgress={editInProgress}
            deployment={project.deployment}
            lastPublishedAt={project.lastPublishedAt}
            onEditStart={() => setEditInProgress(true)}
            onEditComplete={({ jobId, ok, previewSynced, changedFiles }) => {
              setEditInProgress(false);
              if (jobId) setLatestJobId(jobId);
              setDiffRefreshKey((k) => k + 1);
              if (!ok) return;

              previewReloadCancelRef.current?.();
              previewReloadCancelRef.current = null;

              void fetchProject().then(() => {
                const affectsPreview = workspaceEditNeedsPreviewReload(changedFiles ?? []);
                if (!affectsPreview) return;

                if (previewSynced === false) {
                  const schedule = schedulePreviewIframeReloads(
                    () => setPreviewRefreshKey((k) => k + 1),
                    { changedPaths: changedFiles, previewSynced: false }
                  );
                  previewReloadCancelRef.current = schedule.cancel;
                }
              });
            }}
            onRollbackSuccess={handleDeploySuccess}
            onDeploySuccess={handleDeploySuccess}
          />
        </div>
      </div>
    </AppShell>
  );
}

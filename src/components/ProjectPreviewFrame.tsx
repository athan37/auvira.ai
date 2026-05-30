'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelWorkspaceReleaseOnEnter,
  scheduleWorkspaceReleaseOnLeave,
} from '@/lib/runtime/releaseWorkspaceOnLeave';
import { usePageVisible } from '@/lib/hooks/usePageVisible';
import { markEditorVital, recordIframeReload } from '@/lib/metrics/clientVitals';

interface WorkspaceStatus {
  ok?: boolean;
  stage: string;
  label: string;
  ready: boolean;
  error?: string | null;
  previewStatus?: string;
  codeWorkspaceStatus?: string;
  previewHealthy?: boolean;
  previewMode?: 'live' | 'workspace' | 'sandbox';
  liveUrl?: string | null;
}

interface Props {
  projectId: string;
  codeWorkspaceVersion?: number;
  /** Bumped by parent after a successful edit to force iframe reload (Next dev HMR can miss some CSS). */
  previewRefreshKey?: number;
  onReadyChange?: (ready: boolean) => void;
}

const STAGE_ORDER = ['idle', 'cloning', 'installing', 'starting_server', 'ready'] as const;

function stageProgress(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (idx < 0) return 10;
  if (stage === 'ready') return 100;
  return Math.round(((idx + 1) / (STAGE_ORDER.length - 1)) * 90);
}

/** Owner preview: bootstraps GitLab workspace + dev server, then proxies via preview API. */
export function ProjectPreviewFrame({
  projectId,
  codeWorkspaceVersion = 1,
  previewRefreshKey = 0,
  onReadyChange,
}: Props) {
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;
  const [setupLabel, setSetupLabel] = useState('Preparing your project…');
  const [setupStage, setSetupStage] = useState('idle');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewMode, setPreviewMode] = useState<'live' | 'workspace' | 'sandbox'>('workspace');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const applyStatus = useCallback((status: WorkspaceStatus) => {
    setSetupStage(status.stage);
    setSetupLabel(status.label);
    if (
      (status.previewMode === 'live' || status.previewMode === 'sandbox') &&
      status.liveUrl
    ) {
      setPreviewMode(status.previewMode);
      setLivePreviewUrl(status.liveUrl);
    } else {
      setPreviewMode('workspace');
      setLivePreviewUrl(null);
    }
    const isReady = Boolean(status.ready);
    setPreviewReady(isReady);
    onReadyChangeRef.current?.(isReady);
    if (isReady) {
      markEditorVital('editor.preview_ready', { projectId, stage: status.stage });
    }
  }, [projectId]);
  const bootstrapStarted = useRef(false);
  const pollCountRef = useRef(0);
  const pageVisible = usePageVisible();

  const startBootstrap = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workspace/bootstrap`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok && data.ready) {
        applyStatus(data as WorkspaceStatus);
        return true;
      }
      if (!data.ok) {
        setSetupError(data.error || 'Workspace setup failed');
        setSetupStage('failed');
      }
    } catch {
      setSetupError('Network error while setting up workspace');
      setSetupStage('failed');
    }
    return false;
  }, [projectId, applyStatus]);

  const pollStatus = useCallback(async (): Promise<WorkspaceStatus | null> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workspace/status`);
      const data = await res.json();
      if (!data.ok) return null;
      return data as WorkspaceStatus;
    } catch {
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function runBootstrap() {
      setSetupError(null);
      setSetupStage('idle');
      setSetupLabel('Preparing your project…');
      setPreviewReady(false);
      pollCountRef.current = 0;

      const initial = await pollStatus();
      if (cancelled) return;
      if (initial?.ready) {
        applyStatus(initial);
        return;
      }

      if (initial) {
        setSetupStage(initial.stage);
        setSetupLabel(initial.label);
      }

      pollTimer = setInterval(async () => {
        if (!pageVisible) return;
        const status = await pollStatus();
        if (cancelled || !status) return;
        pollCountRef.current += 1;
        applyStatus(status);
        if (status.ready && pollTimer) clearInterval(pollTimer);
        if (status.stage === 'failed' && status.error) {
          setSetupError(status.error);
          if (pollTimer) clearInterval(pollTimer);
        }
        // Stale preview (files on disk but hung dev server) — retry bootstrap after ~6s when
        // status already says restart is required; otherwise wait ~2 min for slow first boot.
        const needsPreviewRestart =
          !status.ready &&
          status.codeWorkspaceStatus === 'ready' &&
          (status.stage === 'starting_server' ||
            status.label?.includes('restart required') ||
            status.label?.includes('stopped responding'));
        const retryAfterPolls = needsPreviewRestart ? 4 : 80;
        if (
          !status.ready &&
          pollCountRef.current >= retryAfterPolls &&
          status.codeWorkspaceStatus === 'ready' &&
          !bootstrapStarted.current
        ) {
          bootstrapStarted.current = true;
          setSetupLabel('Restarting preview server…');
          await startBootstrap();
          bootstrapStarted.current = false;
        }
      }, 1500);

      if (!bootstrapStarted.current) {
        bootstrapStarted.current = true;
        if (!cancelled) {
          await startBootstrap();
        }
        bootstrapStarted.current = false;
      }
    }

    bootstrapStarted.current = false;
    runBootstrap();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [projectId, pollStatus, applyStatus, startBootstrap, pageVisible]);

  useEffect(() => {
    cancelWorkspaceReleaseOnEnter(projectId);
    return () => {
      scheduleWorkspaceReleaseOnLeave(projectId);
    };
  }, [projectId]);

  useEffect(() => {
    if (previewRefreshKey > 0) {
      recordIframeReload(projectId);
    }
  }, [previewRefreshKey, projectId]);

  const handleRefresh = () => {
    setIframeLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const previewUrl = previewReady
    ? previewMode === 'live' && livePreviewUrl
      ? (() => {
          const sep = livePreviewUrl.includes('?') ? '&' : '?';
          return `${livePreviewUrl}${sep}v=${codeWorkspaceVersion}&_=${refreshKey}&pr=${previewRefreshKey}`;
        })()
      : `/api/projects/${projectId}/preview/proxy/?v=${codeWorkspaceVersion}&_=${refreshKey}&pr=${previewRefreshKey}`
    : null;

  const showSetupOverlay = !previewReady || setupError;
  const progress = stageProgress(setupStage);

  return (
    <div className="flex flex-col h-full bg-zinc-50 rounded-lg border border-zinc-200 overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200/80">
        <span className="text-sm font-medium text-zinc-700 truncate">
          {previewMode === 'sandbox'
            ? 'Dev preview'
            : previewMode === 'live'
              ? 'Live website'
              : 'Editable preview'}
        </span>
        {previewMode === 'live' && previewReady && (
          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md ml-2 hidden sm:inline">
            Edits apply in workspace — publish to update live site
          </span>
        )}
        <div className="flex items-center gap-2">
          {previewReady && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 capitalize">
              {setupStage === 'ready'
                ? previewMode === 'sandbox'
                  ? 'Dev'
                  : previewMode === 'live'
                    ? 'Live'
                    : 'Ready'
                : setupStage.replace(/_/g, ' ')}
            </span>
          )}
          {previewReady && iframeLoading && (
            <span className="text-xs text-zinc-500">Loading page…</span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!previewReady}
            className="p-1.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition disabled:opacity-40"
            title="Refresh preview"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-[320px]">
        {showSetupOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white px-6">
            {setupError ? (
              <>
                <p className="text-sm font-medium text-red-700 mb-1">Could not load preview</p>
                <p className="text-xs text-red-600 text-center max-w-md mb-4">{setupError}</p>
                <button
                  type="button"
                  onClick={() => {
                    bootstrapStarted.current = false;
                    window.location.reload();
                  }}
                  className="text-sm text-zinc-950 hover:underline"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <div className="animate-spin h-8 w-8 border-2 border-zinc-950 border-t-transparent rounded-full mb-4" />
                <p className="text-sm font-medium text-zinc-800 mb-1">{setupLabel}</p>
                <p className="text-xs text-zinc-500 mb-4 text-center max-w-sm">
                  First open clones from GitLab and may install dependencies. This can take a few
                  minutes.
                </p>
                <div className="w-full max-w-xs h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 capitalize">
                  {setupStage.replace(/_/g, ' ')}
                </p>
              </>
            )}
          </div>
        )}

        {previewUrl && (
          <iframe
            key={`${projectId}-${codeWorkspaceVersion}-${refreshKey}`}
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoading(false)}
            title="Website Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        )}
      </div>
    </div>
  );
}

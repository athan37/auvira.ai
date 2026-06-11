'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  buildSiteSectionClearMessage,
  buildSiteSectionFocusMessage,
  buildSiteSectionHighlightMessage,
  buildSiteSectionDragCancelMessage,
  buildSiteSectionParentDragStartMessage,
  parseSiteSectionDismissMessage,
  parseSiteSectionDragStartMessage,
  parseSiteSectionPointerDownMessage,
  parseSiteSectionPreviewThumbMessage,
  type ParentToIframeSectionMessage,
  type SelectedSection,
  type SiteSectionContextPayload,
} from '@/lib/preview/sectionSelectionProtocol';
import type { TargetPreviewThumbMessage } from '@/lib/preview/targetPreviewThumbnail';
import {
  cancelWorkspaceReleaseOnEnter,
  scheduleWorkspaceReleaseOnLeave,
} from '@/lib/runtime/releaseWorkspaceOnLeave';
import { usePageVisible } from '@/lib/hooks/usePageVisible';
import { markEditorVital, recordIframeReload } from '@/lib/metrics/clientVitals';
import { PREVIEW_IFRAME_SETTLE_MS } from '@/lib/project-workspace/previewReloadAfterEdit';
import { AuviraLogoMark } from '@/components/marketing/AuviraLogoMark';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { BORDER, LOADING, RADIUS, SURFACE, TEXT } from '@/content/productTheme';

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

export interface PreviewReadyState {
  ready: boolean;
  /** Editable proxy preview with section bridge (not live/cross-origin). */
  targetingAvailable: boolean;
}

interface Props {
  projectId: string;
  /** Bumped with previewWorkspaceVersion after edit — sole driver of post-edit iframe remount. */
  previewRefreshKey?: number;
  /** Workspace version pinned until previewRefreshKey bumps (avoids reload on fetchProject alone). */
  previewWorkspaceVersion?: number;
  /** Hides interim HMR flicker until the single post-edit reload finishes. */
  previewFrozen?: boolean;
  onPreviewReloadSettled?: () => void;
  /** When true, defer iframe remount until edit completes and dev server settles. */
  editInProgress?: boolean;
  onReadyChange?: (state: PreviewReadyState) => void;
  selectedSection?: SelectedSection | null;
  hoverSectionId?: string | null;
  focusSectionId?: string | null;
  focusSectionNonce?: number;
  /** Scroll to section once after the post-edit iframe reload (not on every interim load). */
  postEditFocusSectionId?: string | null;
  postEditFocusNonce?: number;
  onSelectedSectionChange?: (section: SelectedSection | null) => void;
  onSectionDragStart?: (payload: SiteSectionContextPayload, screenX: number, screenY: number) => void;
  onSectionPointerDown?: (payload: SiteSectionContextPayload, screenX: number, screenY: number) => void;
  onSectionHighlightDismiss?: () => void;
  /** Bumped when parent drag threshold is crossed — triggers iframe capture. */
  sectionDragCaptureKey?: number;
  /** Bumped when parent cancels drag (Escape) — clears iframe drag state. */
  sectionDragCancelKey?: number;
  onSectionPreviewThumb?: (thumb: TargetPreviewThumbMessage) => void;
}

const STAGE_ORDER = ['idle', 'cloning', 'installing', 'starting_server', 'ready'] as const;

function isPreviewLoadingStub(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  const title = doc.title?.trim().toLowerCase() ?? '';
  if (title === 'loading preview') return true;
  const bodyText = doc.body?.textContent ?? '';
  return (
    bodyText.includes('Preview server stopped responding') ||
    bodyText.includes('Preview server is not running') ||
    bodyText.includes('Preview Unavailable')
  );
}

function isPreviewConnectionFailed(doc: Document | null | undefined): boolean {
  if (!doc) return true;
  const title = doc.title?.trim().toLowerCase() ?? '';
  const bodyText = doc.body?.textContent?.trim() ?? '';
  if (
    title.includes("can't be reached") ||
    title.includes('refused to connect') ||
    bodyText.includes('refused to connect') ||
    bodyText.includes("This site can't be reached")
  ) {
    return true;
  }
  return doc.body?.childElementCount === 0 && bodyText.length === 0;
}

function stageProgress(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (idx < 0) return 10;
  if (stage === 'ready') return 100;
  return Math.round(((idx + 1) / (STAGE_ORDER.length - 1)) * 90);
}

/** Shared full-pane loader for workspace bootstrap and post-edit preview freeze. */
function PreviewPaneLoadingOverlay({
  title,
  subtitle,
  progressPercent,
  stageLabel,
  indeterminate = false,
}: {
  title: string;
  subtitle?: string;
  progressPercent?: number;
  stageLabel?: string;
  indeterminate?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center px-6',
        LOADING.shell
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <AuviraLogoMark size="lg" />
        <LoadingDots size="lg" />
        <p className={cn('text-sm font-medium', TEXT.primary)}>{title}</p>
        {subtitle ? (
          <p className={cn('text-xs', TEXT.muted)}>{subtitle}</p>
        ) : null}
        <div className={LOADING.progressTrackPane} aria-hidden>
          {indeterminate ? (
            <div className={LOADING.progressShimmer} />
          ) : (
            <div
              className={LOADING.progressFill}
              style={{ width: `${progressPercent ?? 0}%` }}
            />
          )}
        </div>
        {stageLabel ? (
          <p className={cn('text-xs capitalize', TEXT.tertiary)}>{stageLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Owner preview: bootstraps GitLab workspace + dev server, then proxies via preview API. */
export function ProjectPreviewFrame({
  projectId,
  previewRefreshKey = 0,
  previewWorkspaceVersion = 1,
  previewFrozen = false,
  onPreviewReloadSettled,
  editInProgress = false,
  onReadyChange,
  selectedSection = null,
  hoverSectionId = null,
  focusSectionId = null,
  focusSectionNonce = 0,
  postEditFocusSectionId = null,
  postEditFocusNonce = 0,
  onSelectedSectionChange,
  onSectionDragStart,
  onSectionPointerDown,
  onSectionHighlightDismiss,
  sectionDragCaptureKey = 0,
  sectionDragCancelKey = 0,
  onSectionPreviewThumb,
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
  const chunkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunkRetryCountRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastHighlightRef = useRef<{ id: string | null; hover: boolean }>({ id: null, hover: false });
  const savedScrollRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPostEditFocusRef = useRef<string | null>(null);

  const selectionAvailable = previewMode !== 'live';
  const iframeRemountKey = `${projectId}-${previewWorkspaceVersion}-${refreshKey}-${previewRefreshKey}`;

  const postToIframe = useCallback((message: ParentToIframeSectionMessage) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(message, window.location.origin);
    } catch {
      /* cross-origin or detached */
    }
  }, []);

  useEffect(() => {
    if (!selectionAvailable || sectionDragCaptureKey <= 0) return;
    postToIframe(buildSiteSectionParentDragStartMessage());
  }, [sectionDragCaptureKey, selectionAvailable, postToIframe]);

  useEffect(() => {
    if (!selectionAvailable || sectionDragCancelKey <= 0) return;
    postToIframe(buildSiteSectionDragCancelMessage());
  }, [sectionDragCancelKey, selectionAvailable, postToIframe]);

  useEffect(() => {
    if (!selectionAvailable) return;
    const highlightId = hoverSectionId ?? focusSectionId ?? null;
    const hover = Boolean(highlightId && hoverSectionId === highlightId);
    const prev = lastHighlightRef.current;
    if (prev.id === highlightId && prev.hover === hover) return;
    lastHighlightRef.current = { id: highlightId, hover };
    if (highlightId) {
      postToIframe(buildSiteSectionHighlightMessage(highlightId, hover));
    } else {
      postToIframe(buildSiteSectionClearMessage());
    }
  }, [hoverSectionId, focusSectionId, selectionAvailable, postToIframe]);

  useEffect(() => {
    if (!selectionAvailable || !focusSectionId) return;
    postToIframe(buildSiteSectionFocusMessage(focusSectionId));
  }, [focusSectionId, focusSectionNonce, selectionAvailable, postToIframe]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !selectedSection) return;
      onSelectedSectionChange?.(null);
      postToIframe(buildSiteSectionClearMessage());
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSection, onSelectedSectionChange, postToIframe]);

  useEffect(() => {
    if (!postEditFocusSectionId || postEditFocusNonce <= 0) return;
    pendingPostEditFocusRef.current = postEditFocusSectionId;
  }, [postEditFocusSectionId, postEditFocusNonce]);

  useEffect(() => {
    return () => {
      try {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        savedScrollRef.current = { x: win.scrollX, y: win.scrollY };
      } catch {
        /* iframe detached */
      }
    };
  }, [iframeRemountKey]);

  const applyViewportAfterIframeLoad = useCallback(() => {
    if (!selectionAvailable) return;

    const run = (fn: () => void) => {
      window.setTimeout(fn, 50);
    };

    const pendingFocus = pendingPostEditFocusRef.current;
    if (pendingFocus) {
      pendingPostEditFocusRef.current = null;
      run(() => postToIframe(buildSiteSectionFocusMessage(pendingFocus)));
      return;
    }

    const saved = savedScrollRef.current;
    if (!saved) return;
    savedScrollRef.current = null;
    run(() => {
      try {
        iframeRef.current?.contentWindow?.scrollTo(saved.x, saved.y);
      } catch {
        /* cross-origin or detached */
      }
    });
  }, [postToIframe, selectionAvailable]);

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
    const targetingAvailable = isReady && status.previewMode !== 'live';
    setPreviewReady(isReady);
    onReadyChangeRef.current?.({ ready: isReady, targetingAvailable });
    if (isReady) {
      markEditorVital('editor.preview_ready', { projectId, stage: status.stage });
    }
  }, [projectId]);
  const bootstrapStarted = useRef(false);
  const previewRestartInFlight = useRef(false);
  const pollCountRef = useRef(0);
  const unhealthyPollsRef = useRef(0);
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
      } else if (data.stage) {
        applyStatus(data as WorkspaceStatus);
      }
    } catch {
      setSetupError('Network error while setting up workspace');
      setSetupStage('failed');
    }
    return false;
  }, [projectId, applyStatus]);

  const restartPreviewIfStub = useCallback(async () => {
    if (previewRestartInFlight.current || bootstrapStarted.current) return;
    previewRestartInFlight.current = true;
    bootstrapStarted.current = true;
    setPreviewReady(false);
    setSetupStage('starting_server');
    setSetupLabel('Restarting preview server…');
    try {
      await startBootstrap();
    } finally {
      bootstrapStarted.current = false;
      previewRestartInFlight.current = false;
    }
  }, [startBootstrap]);

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

    async function maybeRestartPreview(status: WorkspaceStatus): Promise<void> {
      const needsPreviewRestart =
        !status.ready &&
        status.codeWorkspaceStatus === 'ready' &&
        (status.stage === 'starting_server' ||
          status.previewHealthy === false ||
          status.label?.includes('restart required') ||
          status.label?.includes('stopped responding'));
      if (!needsPreviewRestart || bootstrapStarted.current) return;
      bootstrapStarted.current = true;
      setPreviewReady(false);
      setSetupLabel('Restarting preview server…');
      setSetupStage('starting_server');
      try {
        await startBootstrap();
      } finally {
        bootstrapStarted.current = false;
      }
    }

    async function runBootstrap() {
      setSetupError(null);
      setSetupStage('idle');
      setSetupLabel('Preparing your project…');
      setPreviewReady(false);
      pollCountRef.current = 0;

      const initial = await pollStatus();
      if (cancelled) return;

      if (initial?.ready && initial.previewHealthy !== false) {
        applyStatus(initial);
      } else {
        if (initial) {
          setSetupStage(initial.stage);
          setSetupLabel(initial.label);
        }
        if (!bootstrapStarted.current) {
          bootstrapStarted.current = true;
          await startBootstrap();
          bootstrapStarted.current = false;
        }
      }

      pollTimer = setInterval(async () => {
        if (!pageVisible) return;
        const status = await pollStatus();
        if (cancelled || !status) return;
        pollCountRef.current += 1;
        applyStatus(status);
        if (status.stage === 'failed' && status.error) {
          setSetupError(status.error);
        }

        if (status.ready && status.previewHealthy !== false) {
          unhealthyPollsRef.current = 0;
        } else {
          unhealthyPollsRef.current += 1;
          if (unhealthyPollsRef.current >= 2) {
            unhealthyPollsRef.current = 0;
            await maybeRestartPreview(status);
          }
        }
      }, 3000);
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

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === 'preview-chunk-error') {
        if (editInProgress || chunkRetryCountRef.current >= 2) return;

        chunkRetryCountRef.current += 1;
        if (chunkRetryTimerRef.current) clearTimeout(chunkRetryTimerRef.current);
        chunkRetryTimerRef.current = setTimeout(() => {
          setIframeLoading(true);
          setRefreshKey((prev) => prev + 1);
        }, PREVIEW_IFRAME_SETTLE_MS);
        return;
      }

      const dragStart = parseSiteSectionDragStartMessage(event.data);
      if (dragStart && selectionAvailable) {
        const rect = iframeRef.current?.getBoundingClientRect();
        if (!rect) return;
        onSectionDragStart?.(
          dragStart.payload,
          rect.left + dragStart.payload.clientX,
          rect.top + dragStart.payload.clientY
        );
        return;
      }

      const pointerDown = parseSiteSectionPointerDownMessage(event.data);
      if (pointerDown && selectionAvailable) {
        const rect = iframeRef.current?.getBoundingClientRect();
        if (!rect) return;
        onSectionPointerDown?.(
          pointerDown.payload,
          rect.left + pointerDown.payload.clientX,
          rect.top + pointerDown.payload.clientY
        );
        return;
      }

      const previewThumb = parseSiteSectionPreviewThumbMessage(event.data);
      if (previewThumb && selectionAvailable) {
        onSectionPreviewThumb?.(previewThumb.payload);
        return;
      }

      const dismiss = parseSiteSectionDismissMessage(event.data);
      if (dismiss && selectionAvailable) {
        onSectionHighlightDismiss?.();
      }
    }

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (chunkRetryTimerRef.current) clearTimeout(chunkRetryTimerRef.current);
    };
  }, [editInProgress, onSectionDragStart, onSectionPointerDown, onSectionHighlightDismiss, onSectionPreviewThumb, selectionAvailable]);

  const handleRefresh = () => {
    setIframeLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const previewUrl = previewReady
    ? previewMode === 'live' && livePreviewUrl
      ? (() => {
          const sep = livePreviewUrl.includes('?') ? '&' : '?';
          return `${livePreviewUrl}${sep}v=${previewWorkspaceVersion}&_=${refreshKey}&pr=${previewRefreshKey}`;
        })()
      : `/api/projects/${projectId}/preview/proxy/?v=${previewWorkspaceVersion}&_=${refreshKey}&pr=${previewRefreshKey}`
    : null;

  const showSetupOverlay = !previewReady || setupError;
  const progress = stageProgress(setupStage);

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden shadow-card border',
        RADIUS.card,
        'bg-[#f5f5f7]',
        BORDER.hairline
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 glass-nav">
        <span className={cn('text-sm font-medium truncate', TEXT.primary)}>
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
          {previewReady && !selectionAvailable && (
            <span
              className={cn('text-[10px] hidden sm:inline', TEXT.muted)}
              title="Drag sections to chat in editor preview"
            >
              Drag sections in editor preview
            </span>
          )}
          {previewReady && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-md capitalize bg-[#f5f5f7]',
                TEXT.primary
              )}
            >
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
            <span className={cn('text-xs', TEXT.muted)}>Loading page…</span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!previewReady}
            className={cn(
              'p-1.5 rounded-md transition disabled:opacity-40',
              TEXT.muted,
              'hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
            )}
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
        {showSetupOverlay && setupError ? (
          <div
            className={cn(
              'absolute inset-0 z-20 flex flex-col items-center justify-center px-6',
              LOADING.shell
            )}
          >
            <p className="text-sm font-medium text-red-700 mb-1">Could not load preview</p>
            <p className="text-xs text-red-600 text-center max-w-md mb-4">{setupError}</p>
            <button
              type="button"
              onClick={() => {
                bootstrapStarted.current = false;
                window.location.reload();
              }}
              className={cn('text-sm hover:underline', TEXT.primary)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {showSetupOverlay && !setupError ? (
          <PreviewPaneLoadingOverlay
            title={setupLabel}
            subtitle="First open clones from GitLab and may install dependencies. This can take a few minutes."
            progressPercent={progress}
            stageLabel={setupStage.replace(/_/g, ' ')}
          />
        ) : null}

        {previewFrozen && previewReady && !showSetupOverlay ? (
          <PreviewPaneLoadingOverlay
            title="Updating preview…"
            subtitle="Your changes will appear when the edit is complete."
            indeterminate
            stageLabel="applying change"
          />
        ) : null}

        {previewUrl && (
          <iframe
            ref={iframeRef}
            key={iframeRemountKey}
            src={previewUrl}
            className={cn('w-full h-full border-0', previewFrozen && 'invisible')}
            aria-hidden={previewFrozen}
            onLoad={() => {
              setIframeLoading(false);
              chunkRetryCountRef.current = 0;
              lastHighlightRef.current = { id: null, hover: false };
              if (selectionAvailable) {
                const doc = iframeRef.current?.contentDocument;
                if (isPreviewConnectionFailed(doc) || isPreviewLoadingStub(doc)) {
                  void restartPreviewIfStub();
                  return;
                }
                const highlightId = hoverSectionId ?? focusSectionId ?? null;
                const hover = Boolean(highlightId && hoverSectionId === highlightId);
                if (highlightId) {
                  lastHighlightRef.current = { id: highlightId, hover };
                  postToIframe(buildSiteSectionHighlightMessage(highlightId, hover));
                }
                applyViewportAfterIframeLoad();
                if (previewFrozen) {
                  onPreviewReloadSettled?.();
                }
              }
            }}
            title="Website Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        )}
      </div>
    </div>
  );
}

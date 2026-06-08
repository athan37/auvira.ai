'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectPreviewFrame, type PreviewReadyState } from '@/components/ProjectPreviewFrame';
import {
  schedulePreviewIframeReloads,
  workspaceEditNeedsPreviewReload,
} from '@/lib/project-workspace/previewReloadAfterEdit';
import { ProjectEditorSidebar } from '@/components/project/ProjectEditorSidebar';
import { UnpublishedChangesBadge } from '@/components/UnpublishedChangesBadge';
import { ownerProjectStatusLabel } from '@/lib/owner/ownerCopy';
import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { LoadingShell } from '@/components/ui/LoadingShell';
import { Toast } from '@/components/ui/Toast';
import { ACCENT, SURFACE, TEXT } from '@/content/productTheme';
import { projectSupportsV3Edits } from '@/lib/project-workspace/requireGitLabProject';
import { SectionDragGhost } from '@/components/project/SectionDragGhost';
import { ProjectWorkspaceTabs } from '@/components/project/ProjectWorkspaceTabs';
import { formatPreviewTargetLabel } from '@/lib/preview/previewTargetChipLabels';
import {
  selectedSectionFromPayload,
  type SelectedSection,
  type SiteSectionContextPayload,
} from '@/lib/preview/sectionSelectionProtocol';
import type {
  TargetPreviewCaptureKind,
  TargetPreviewThumbMessage,
} from '@/lib/preview/targetPreviewThumbnail';
import { uploadTargetPreviewThumbnail } from '@/lib/preview/uploadTargetPreviewThumbnail';
import { cn } from '@/lib/cn';

const SECTION_DRAG_THRESHOLD = 6;

function previewTargetLabelFromSection(section: SelectedSection): string {
  return formatPreviewTargetLabel({
    kind: section.kind,
    sectionId: section.sectionId,
    analyticsId: section.analyticsId,
    sectionIndex: section.sectionIndex,
    sectionType: section.sectionType,
    sectionTitle: section.sectionTitle,
    fieldPath: section.fieldPath,
    itemIndex: section.itemIndex,
    elementKind: section.elementKind,
    elementLabel: section.elementLabel,
  });
}

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
  const [previewTargetingAvailable, setPreviewTargetingAvailable] = useState(false);
  const [editInProgress, setEditInProgress] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SelectedSection | null>(null);
  const [historyHoverSectionId, setHistoryHoverSectionId] = useState<string | null>(null);
  const [focusedHistorySectionId, setFocusedHistorySectionId] = useState<string | null>(null);
  const [historyFocusNonce, setHistoryFocusNonce] = useState(0);
  const [sectionToast, setSectionToast] = useState<string | null>(null);
  const [focusChatInputKey, setFocusChatInputKey] = useState(0);
  const [scratchWarning, setScratchWarning] = useState<string | null>(null);
  const previewReloadCancelRef = useRef<(() => void) | null>(null);
  const chatDropZoneRef = useRef<HTMLDivElement>(null);
  const sectionDragPayloadRef = useRef<SiteSectionContextPayload | null>(null);
  const [sectionDrag, setSectionDrag] = useState<{
    payload: SiteSectionContextPayload;
    x: number;
    y: number;
    previewDataUrl?: string;
    previewCaptureKind?: TargetPreviewCaptureKind;
    previewWidth?: number;
    previewHeight?: number;
    grabOffsetX?: number;
    grabOffsetY?: number;
  } | null>(null);
  const [sectionDragCaptureKey, setSectionDragCaptureKey] = useState(0);
  const [sectionDragCancelKey, setSectionDragCancelKey] = useState(0);
  const sectionDragPendingPayloadRef = useRef<SiteSectionContextPayload | null>(null);
  const [sectionDragPending, setSectionDragPending] = useState<{
    payload: SiteSectionContextPayload;
    startX: number;
    startY: number;
    previewDataUrl?: string;
    previewCaptureKind?: TargetPreviewCaptureKind;
    previewWidth?: number;
    previewHeight?: number;
    grabOffsetX?: number;
    grabOffsetY?: number;
  } | null>(null);
  const sectionDragRef = useRef(sectionDrag);
  sectionDragRef.current = sectionDrag;
  const sectionDragPendingRef = useRef(sectionDragPending);
  sectionDragPendingRef.current = sectionDragPending;
  const finishSectionDragRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const handleSectionDragMoveRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const sectionDragFinishingRef = useRef(false);
  const [isChatDropActive, setIsChatDropActive] = useState(false);

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

  const handleClearSelection = useCallback(() => {
    setSelectedSection(null);
  }, []);

  const handleSectionHighlightDismiss = useCallback(() => {
    setFocusedHistorySectionId(null);
    setHistoryHoverSectionId(null);
  }, []);

  const handleHistorySectionClick = useCallback((sectionId: string) => {
    setFocusedHistorySectionId(sectionId);
    setHistoryFocusNonce((n) => n + 1);
  }, []);

  const handleSelectedSectionChange = useCallback((section: SelectedSection | null) => {
    setSelectedSection(section);
    if (section) {
      setSectionToast(`Added "${previewTargetLabelFromSection(section)}" to chat`);
      setFocusChatInputKey((k) => k + 1);
    }
  }, []);

  const isPointInChatDropZone = useCallback((clientX: number, clientY: number) => {
    const dropEl = chatDropZoneRef.current;
    if (!dropEl) return false;
    const rect = dropEl.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  const clearSectionDragUi = useCallback(() => {
    sectionDragPayloadRef.current = null;
    sectionDragPendingPayloadRef.current = null;
    setSectionDrag(null);
    setSectionDragPending(null);
    setIsChatDropActive(false);
    setSectionDragCancelKey((key) => key + 1);
  }, []);

  const finishSectionDrag = useCallback(
    async (clientX: number, clientY: number) => {
      if (sectionDragFinishingRef.current) return;
      sectionDragFinishingRef.current = true;

      const payloadToDrop = sectionDragPayloadRef.current;
      const dragPreview = sectionDragRef.current;
      const shouldDrop = Boolean(payloadToDrop && isPointInChatDropZone(clientX, clientY));

      clearSectionDragUi();

      try {
        if (!shouldDrop || !payloadToDrop) return;

        let section = selectedSectionFromPayload(payloadToDrop);
        const dataUrl = dragPreview?.previewDataUrl;
        if (dataUrl) {
          section = { ...section, previewThumbnailDataUrl: dataUrl };
          handleSelectedSectionChange(section);
          try {
            const uploaded = await uploadTargetPreviewThumbnail(
              projectId,
              dataUrl,
              dragPreview?.previewCaptureKind,
              { width: dragPreview?.previewWidth, height: dragPreview?.previewHeight }
            );
            setSelectedSection((prev) =>
              prev && prev.sectionId === section.sectionId
                ? { ...prev, previewThumbnail: uploaded, previewThumbnailDataUrl: undefined }
                : prev
            );
          } catch {
            /* keep transient data URL if upload fails */
          }
        } else {
          handleSelectedSectionChange(section);
        }
      } finally {
        sectionDragFinishingRef.current = false;
      }
    },
    [clearSectionDragUi, handleSelectedSectionChange, isPointInChatDropZone, projectId]
  );
  finishSectionDragRef.current = finishSectionDrag;

  const thumbMatchesPayload = useCallback(
    (payload: SiteSectionContextPayload, thumb: TargetPreviewThumbMessage) => {
      if (payload.sectionId !== thumb.sectionId) return false;
      if (payload.fieldPath && thumb.fieldPath) {
        return payload.fieldPath === thumb.fieldPath;
      }
      if (thumb.surfaceId && payload.surfaceId) {
        return thumb.surfaceId === payload.surfaceId;
      }
      return true;
    },
    []
  );

  const handleSectionPointerDown = useCallback(
    (payload: SiteSectionContextPayload, screenX: number, screenY: number) => {
      sectionDragPayloadRef.current = null;
      setSectionDrag(null);
      sectionDragPendingPayloadRef.current = payload;
      setSectionDragPending({
        payload,
        startX: screenX,
        startY: screenY,
        grabOffsetX: payload.grabOffsetX,
        grabOffsetY: payload.grabOffsetY,
      });
      setIsChatDropActive(isPointInChatDropZone(screenX, screenY));
    },
    [isPointInChatDropZone]
  );

  const handleSectionDragStart = useCallback(
    (payload: SiteSectionContextPayload, screenX: number, screenY: number) => {
      sectionDragPayloadRef.current = payload;
      const pending = sectionDragPendingRef.current;
      setSectionDrag({
        payload,
        x: screenX,
        y: screenY,
        previewDataUrl: pending?.previewDataUrl,
        previewCaptureKind: pending?.previewCaptureKind,
        previewWidth: pending?.previewWidth,
        previewHeight: pending?.previewHeight,
        grabOffsetX: payload.grabOffsetX ?? pending?.grabOffsetX,
        grabOffsetY: payload.grabOffsetY ?? pending?.grabOffsetY,
      });
      sectionDragPendingPayloadRef.current = null;
      setSectionDragPending(null);
      setSectionDragCaptureKey((key) => key + 1);
      setIsChatDropActive(isPointInChatDropZone(screenX, screenY));
    },
    [isPointInChatDropZone]
  );

  const handleSectionPreviewThumb = useCallback(
    (thumb: TargetPreviewThumbMessage) => {
      const activePayload = sectionDragPayloadRef.current;
      const pendingPayload = sectionDragPendingPayloadRef.current;
      const preview = {
        previewDataUrl: thumb.dataUrl,
        previewCaptureKind: thumb.captureKind,
        previewWidth: thumb.width,
        previewHeight: thumb.height,
      };

      const shouldAcceptPreviewUpdate = (
        existing:
          | {
              previewDataUrl?: string;
              previewCaptureKind?: TargetPreviewThumbMessage['captureKind'];
            }
          | null
          | undefined
      ) => {
        if (!existing?.previewDataUrl) return true;
        if (
          existing.previewCaptureKind === 'styled_fallback' &&
          thumb.captureKind === 'raster'
        ) {
          return false;
        }
        return true;
      };

      if (activePayload && thumbMatchesPayload(activePayload, thumb)) {
        setSectionDrag((prev) =>
          prev && shouldAcceptPreviewUpdate(prev) ? { ...prev, ...preview } : prev
        );
        return;
      }

      if (pendingPayload && thumbMatchesPayload(pendingPayload, thumb)) {
        setSectionDragPending((prev) =>
          prev && shouldAcceptPreviewUpdate(prev) ? { ...prev, ...preview } : prev
        );
      }
    },
    [thumbMatchesPayload]
  );

  const cancelSectionDrag = useCallback(() => {
    if (!sectionDrag && !sectionDragPending) return;
    clearSectionDragUi();
  }, [clearSectionDragUi, sectionDrag, sectionDragPending]);

  const handleSectionDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const pending = sectionDragPendingRef.current;
      const activeDrag = sectionDragRef.current;
      if (pending && !activeDrag) {
        const dx = clientX - pending.startX;
        const dy = clientY - pending.startY;
        if (dx * dx + dy * dy >= SECTION_DRAG_THRESHOLD * SECTION_DRAG_THRESHOLD) {
          handleSectionDragStart(pending.payload, clientX, clientY);
          return;
        }
        setIsChatDropActive(isPointInChatDropZone(clientX, clientY));
        return;
      }
      setSectionDrag((prev) => (prev ? { ...prev, x: clientX, y: clientY } : null));
      setIsChatDropActive(isPointInChatDropZone(clientX, clientY));
    },
    [handleSectionDragStart, isPointInChatDropZone]
  );
  handleSectionDragMoveRef.current = handleSectionDragMove;

  useEffect(() => {
    if (!sectionDragPending && !sectionDrag) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = sectionDrag ? 'grabbing' : 'grab';
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [sectionDragPending, sectionDrag]);

  useEffect(() => {
    if (!sectionDragPending && !sectionDrag) return;
    function onWindowMouseMove(event: MouseEvent) {
      handleSectionDragMoveRef.current(event.clientX, event.clientY);
    }
    function onWindowMouseUp(event: MouseEvent) {
      finishSectionDragRef.current(event.clientX, event.clientY);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        cancelSectionDrag();
      }
    }
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sectionDragPending, sectionDrag, cancelSectionDrag]);

  useEffect(() => {
    if (!sectionToast) return;
    const timer = setTimeout(() => setSectionToast(null), 3500);
    return () => clearTimeout(timer);
  }, [sectionToast]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-section-chat-label]')) return;
      handleSectionHighlightDismiss();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [handleSectionHighlightDismiss]);

  const handlePreviewReadyChange = useCallback((state: PreviewReadyState) => {
    setPreviewReady(state.ready);
    setPreviewTargetingAvailable(state.targetingAvailable);
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
    return <LoadingShell message="Opening project…" />;
  }

  if (error || !project) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${SURFACE.alt}`}>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
          <Link href="/dashboard" className={`text-sm ${ACCENT.link} hover:underline`}>
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
          <Link href="/dashboard" className={`${ACCENT.link} hover:underline`}>
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
              className={cn('text-xs hidden sm:inline', TEXT.tertiary, 'hover:text-[#1d1d1f]')}
            >
              Backup (advanced)
            </a>
          )}
        </div>
      }
    >
      <div className="px-3 lg:px-4 pt-3">
        <ProjectWorkspaceTabs projectId={projectId} />
      </div>
      {scratchWarning && (
        <div className="px-3 lg:px-4 pt-3">
          <Alert variant="warning">{scratchWarning}</Alert>
        </div>
      )}
      {sectionToast && <Toast message={sectionToast} />}
      {sectionDrag ? (
        <SectionDragGhost
          payload={sectionDrag.payload}
          x={sectionDrag.x}
          y={sectionDrag.y}
          previewDataUrl={sectionDrag.previewDataUrl}
          previewWidth={sectionDrag.previewWidth}
          previewHeight={sectionDrag.previewHeight}
          grabOffsetX={sectionDrag.grabOffsetX}
          grabOffsetY={sectionDrag.grabOffsetY}
        />
      ) : null}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 h-[calc(100vh-3.5rem)] p-3 lg:p-4 gap-3 lg:gap-4">
        <div className="flex-1 min-h-[320px] lg:min-h-0 min-w-0 flex flex-col">
          <ProjectPreviewFrame
            projectId={projectId}
            codeWorkspaceVersion={project.codeWorkspace?.version}
            previewRefreshKey={previewRefreshKey}
            editInProgress={editInProgress}
            onReadyChange={handlePreviewReadyChange}
            selectedSection={selectedSection}
            hoverSectionId={historyHoverSectionId}
            focusSectionId={focusedHistorySectionId}
            focusSectionNonce={historyFocusNonce}
            onSelectedSectionChange={handleSelectedSectionChange}
            onSectionDragStart={handleSectionDragStart}
            onSectionPointerDown={handleSectionPointerDown}
            onSectionHighlightDismiss={handleSectionHighlightDismiss}
            sectionDragCaptureKey={sectionDragCaptureKey}
            sectionDragCancelKey={sectionDragCancelKey}
            onSectionPreviewThumb={handleSectionPreviewThumb}
          />
        </div>

        <div
          ref={chatDropZoneRef}
          className="w-full lg:w-[440px] xl:w-[520px] shrink-0 min-h-[400px] lg:min-h-0 flex flex-col relative"
        >
          {(sectionDrag || sectionDragPending) && (
            <div
              className={`pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-dashed transition-colors ${
                isChatDropActive
                  ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-400 ring-offset-2'
                  : 'border-rose-300/80 bg-rose-50/20'
              }`}
              aria-hidden
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-rose-700 shadow-sm">
                  {isChatDropActive
                    ? 'Release to add to chat'
                    : sectionDragPending
                      ? 'Drag here to target'
                      : 'Drop here'}
                </span>
              </div>
            </div>
          )}
          <ProjectEditorSidebar
            projectId={projectId}
            previewReady={previewReady}
            previewTargetingAvailable={previewTargetingAvailable}
            selectedSection={selectedSection}
            onClearSelectedSection={handleClearSelection}
            onHistorySectionHover={setHistoryHoverSectionId}
            onHistorySectionClick={handleHistorySectionClick}
            focusedHistorySectionId={focusedHistorySectionId}
            focusChatInputKey={focusChatInputKey}
            isChatDropActive={isChatDropActive}
            isSectionDragging={sectionDrag !== null || sectionDragPending !== null}
            needsSave={project.needsSave ?? project.hasUnpublishedChanges}
            hasGitlab={projectSupportsV3Edits(project)}
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

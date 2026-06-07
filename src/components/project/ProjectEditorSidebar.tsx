'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { ACCENT, BORDER, RADIUS, TEXT } from '@/content/productTheme';
import { ProjectPreviewChat, type EditCompleteResult } from '@/components/ProjectPreviewChat';
import { OWNER_COPY } from '@/lib/owner/ownerCopy';
import {
  LazyBusinessWatchCard,
  LazyChangedFilesPanel,
  LazyPublishedStatusCard,
  LazySaveDeployActions,
} from '@/components/project/lazySidebarPanels';

type Tab = 'chat' | 'changes' | 'publish' | 'watch';

interface Deployment {
  provider?: string;
  status?: string;
  ready?: boolean;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  vercelProjectName?: string;
  error?: string;
}

interface Props {
  projectId: string;
  previewReady: boolean;
  previewTargetingAvailable?: boolean;
  selectedSection?: import('@/lib/preview/sectionSelectionProtocol').SelectedSection | null;
  onClearSelectedSection?: () => void;
  onHistorySectionHover?: (sectionId: string | null) => void;
  onHistorySectionClick?: (sectionId: string) => void;
  focusedHistorySectionId?: string | null;
  focusChatInputKey?: number;
  isChatDropActive?: boolean;
  isSectionDragging?: boolean;
  needsSave?: boolean;
  hasGitlab?: boolean;
  gitlabWebUrl?: string | null;
  latestJobId: string | null;
  diffRefreshKey: number;
  editInProgress?: boolean;
  deployment?: Deployment | null;
  lastPublishedAt?: string;
  onEditStart?: () => void;
  /** @deprecated Prefer onEditComplete — avoids duplicate project refetch. */
  onEditSuccess?: () => void;
  onEditComplete: (result: EditCompleteResult) => void;
  onRollbackSuccess: () => void;
  onDeploySuccess: () => void;
}

export function ProjectEditorSidebar({
  projectId,
  previewReady,
  previewTargetingAvailable = false,
  selectedSection,
  onClearSelectedSection,
  onHistorySectionHover,
  onHistorySectionClick,
  focusedHistorySectionId = null,
  focusChatInputKey = 0,
  isChatDropActive = false,
  isSectionDragging = false,
  needsSave,
  hasGitlab,
  gitlabWebUrl,
  latestJobId,
  diffRefreshKey,
  editInProgress,
  deployment,
  lastPublishedAt,
  onEditStart,
  onEditSuccess,
  onEditComplete,
  onRollbackSuccess,
  onDeploySuccess,
}: Props) {
  const [tab, setTab] = useState<Tab>('chat');

  useEffect(() => {
    if (focusChatInputKey > 0) {
      setTab('chat');
    }
  }, [focusChatInputKey]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'changes', label: 'Changes' },
    { id: 'publish', label: 'Publish' },
    { id: 'watch', label: 'Watch' },
  ];

  return (
    <div
      className={cn(
        'flex flex-col h-full min-h-0 relative transition-shadow',
        RADIUS.card,
        isSectionDragging && 'ring-2 ring-rose-300 ring-offset-2',
        isChatDropActive && ACCENT.dropZone
      )}
    >
      <div
        className={cn(
          'flex glass-panel overflow-hidden shrink-0 rounded-t-2xl border-b',
          BORDER.hairline
        )}
        role="tablist"
        aria-label="Project editor"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`editor-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`editor-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? cn('editor-tab-active bg-white/60', TEXT.primary)
                : cn(TEXT.muted, 'hover:text-[#1d1d1f] hover:bg-white/40')
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'flex-1 min-h-0 glass-panel rounded-b-2xl border border-t-0 relative',
          BORDER.hairline,
          needsSave && tab === 'changes' ? 'pb-20' : ''
        )}
      >
        {/* Chat stays mounted to preserve Virtuoso scroll state */}
        <div
          id="editor-panel-chat"
          role="tabpanel"
          aria-labelledby="editor-tab-chat"
          hidden={tab !== 'chat'}
          className={cn(
            'absolute inset-0 flex flex-col overflow-hidden p-3',
            tab !== 'chat' && 'invisible pointer-events-none'
          )}
        >
          <ProjectPreviewChat
            projectId={projectId}
            disabled={!previewReady || !hasGitlab}
            previewReady={previewReady}
            previewTargetingAvailable={previewTargetingAvailable}
            legacyProject={!hasGitlab}
            selectedSection={selectedSection}
            onClearSelectedSection={onClearSelectedSection}
            onHistorySectionHover={onHistorySectionHover}
            onHistorySectionClick={onHistorySectionClick}
            focusedHistorySectionId={focusedHistorySectionId}
            focusChatInputKey={focusChatInputKey}
            onEditStart={onEditStart}
            onEditSuccess={onEditSuccess}
            onEditComplete={onEditComplete}
          />
        </div>

        <div
          id="editor-panel-changes"
          role="tabpanel"
          aria-labelledby="editor-tab-changes"
          hidden={tab !== 'changes'}
          className={cn(
            'absolute inset-0 overflow-y-auto p-3 space-y-3',
            tab !== 'changes' && 'hidden'
          )}
        >
          {tab === 'changes' && (
            <LazyChangedFilesPanel
              projectId={projectId}
              jobId={latestJobId}
              refreshKey={diffRefreshKey}
              editInProgress={editInProgress}
              onRollbackSuccess={onRollbackSuccess}
              onForceSyncSuccess={onDeploySuccess}
            />
          )}
        </div>

        <div
          id="editor-panel-publish"
          role="tabpanel"
          aria-labelledby="editor-tab-publish"
          hidden={tab !== 'publish'}
          className={cn(
            'absolute inset-0 overflow-y-auto p-3 space-y-3',
            tab !== 'publish' && 'hidden'
          )}
        >
          {tab === 'publish' && (
            <>
              <LazyPublishedStatusCard
                projectId={projectId}
                deployment={deployment}
                lastPublishedAt={lastPublishedAt}
                gitlabWebUrl={gitlabWebUrl}
                onDeploymentUpdate={onDeploySuccess}
                pollingEnabled
              />
              <LazySaveDeployActions
                projectId={projectId}
                needsSave={needsSave}
                hasGitlab={hasGitlab}
                deploymentStatus={deployment?.status}
                onSaveSuccess={onDeploySuccess}
                onDeploySuccess={onDeploySuccess}
              />
            </>
          )}
        </div>

        <div
          id="editor-panel-watch"
          role="tabpanel"
          aria-labelledby="editor-tab-watch"
          hidden={tab !== 'watch'}
          className={cn(
            'absolute inset-0 overflow-y-auto p-3 space-y-3',
            tab !== 'watch' && 'hidden'
          )}
        >
          {tab === 'watch' && (
            <LazyBusinessWatchCard projectId={projectId} onRefresh={onDeploySuccess} />
          )}
        </div>
      </div>

      {needsSave && tab === 'changes' && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 p-3 glass-panel border-t rounded-b-2xl shadow-lg z-10',
            BORDER.hairline
          )}
        >
          <LazySaveDeployActions
            projectId={projectId}
            needsSave={needsSave}
            hasGitlab={hasGitlab}
            deploymentStatus={deployment?.status}
            onSaveSuccess={onDeploySuccess}
            onDeploySuccess={onDeploySuccess}
            compact
          />
          <p className={cn('text-[10px] text-center mt-1', TEXT.tertiary)}>{OWNER_COPY.publishLiveHint}</p>
        </div>
      )}
    </div>
  );
}

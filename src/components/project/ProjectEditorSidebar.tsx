'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'changes', label: 'Changes' },
    { id: 'publish', label: 'Publish' },
    { id: 'watch', label: 'Watch' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <div
        className="flex border-b border-zinc-200/80 bg-white rounded-t-xl overflow-hidden shrink-0"
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
                ? 'text-zinc-950 border-b-2 border-zinc-950 bg-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'flex-1 min-h-0 bg-zinc-50/50 rounded-b-xl border border-t-0 border-zinc-200/80 relative',
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
            disabled={!previewReady}
            previewReady={previewReady}
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
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-zinc-200 rounded-b-xl shadow-lg z-10">
          <LazySaveDeployActions
            projectId={projectId}
            needsSave={needsSave}
            hasGitlab={hasGitlab}
            deploymentStatus={deployment?.status}
            onSaveSuccess={onDeploySuccess}
            onDeploySuccess={onDeploySuccess}
            compact
          />
          <p className="text-[10px] text-zinc-400 text-center mt-1">{OWNER_COPY.publishLiveHint}</p>
        </div>
      )}
    </div>
  );
}

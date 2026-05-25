'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { ProjectPreviewChat, type EditCompleteResult } from '@/components/ProjectPreviewChat';
import { ChangedFilesPanel } from '@/components/project/ChangedFilesPanel';
import { SaveDeployActions } from '@/components/SaveDeployActions';
import { PublishedStatusCard } from '@/components/PublishedStatusCard';
import { BusinessWatchCard } from '@/components/site-manager/BusinessWatchCard';
import { OWNER_COPY } from '@/lib/owner/ownerCopy';

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
  onEditSuccess: () => void;
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
      <div className="flex border-b border-zinc-200/80 bg-white rounded-t-xl overflow-hidden shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
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
          'flex-1 min-h-0 bg-zinc-50/50 rounded-b-xl border border-t-0 border-zinc-200/80',
          tab === 'chat' ? 'flex flex-col overflow-hidden p-3' : 'overflow-y-auto p-3 space-y-3',
          needsSave && tab === 'changes' ? 'pb-20' : 'pb-3'
        )}
      >
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <ProjectPreviewChat
              projectId={projectId}
              disabled={!previewReady}
              previewReady={previewReady}
              onEditStart={onEditStart}
              onEditSuccess={onEditSuccess}
              onEditComplete={onEditComplete}
            />
          </div>
        )}

        {tab === 'changes' && (
          <ChangedFilesPanel
            projectId={projectId}
            jobId={latestJobId}
            refreshKey={diffRefreshKey}
            editInProgress={editInProgress}
            onRollbackSuccess={onRollbackSuccess}
            onForceSyncSuccess={onDeploySuccess}
          />
        )}

        {tab === 'publish' && (
          <div className="space-y-3">
            <PublishedStatusCard
              projectId={projectId}
              deployment={deployment}
              lastPublishedAt={lastPublishedAt}
              gitlabWebUrl={gitlabWebUrl}
              onDeploymentUpdate={onDeploySuccess}
            />
            <SaveDeployActions
              projectId={projectId}
              needsSave={needsSave}
              hasGitlab={hasGitlab}
              deploymentStatus={deployment?.status}
              onSaveSuccess={onDeploySuccess}
              onDeploySuccess={onDeploySuccess}
            />
          </div>
        )}

        {tab === 'watch' && (
          <BusinessWatchCard projectId={projectId} onRefresh={onDeploySuccess} />
        )}
      </div>

      {needsSave && tab === 'changes' && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-zinc-200 rounded-b-xl shadow-lg">
          <SaveDeployActions
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


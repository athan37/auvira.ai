'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ACCENT, BORDER, TEXT } from '@/content/productTheme';
import { OWNER_COPY } from '@/lib/owner/ownerCopy';

type PublishMode = 'editor' | 'clone';

interface Props {
  mode: PublishMode;
  targetId: string;
  needsSave?: boolean;
  hasGitlab?: boolean;
  deploymentStatus?: string;
  createdProjectId?: string;
  gitlabWebUrl?: string | null;
  onSaveSuccess?: () => void;
  onDeploySuccess?: () => void;
  compact?: boolean;
}

/** Unified backup + publish UI for editor and clone wizard. */
export function PublishActions({
  mode,
  targetId,
  needsSave = false,
  hasGitlab = true,
  deploymentStatus,
  createdProjectId,
  gitlabWebUrl,
  onSaveSuccess,
  onDeploySuccess,
  compact = false,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveSuccessDetail, setSaveSuccessDetail] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployNote, setDeployNote] = useState<string | null>(null);
  const [productionUrl, setProductionUrl] = useState<string | null>(null);
  const [lastSavedProjectId, setLastSavedProjectId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const projectId = mode === 'editor' ? targetId : createdProjectId || lastSavedProjectId;
  const isVercelBuilding =
    deploymentStatus === 'building' ||
    deploymentStatus === 'pending' ||
    deploymentStatus === 'triggered';
  const deployInProgress = deploying || polling || isVercelBuilding;
  const canBackup = mode === 'editor' ? hasGitlab : true;
  const backupDisabled = mode === 'editor' && (!needsSave || !hasGitlab);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollEditorDeployment = (expectedUrl?: string | null) => {
    if (!projectId) return;
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/projects/${projectId}/deployment-status`);
        const data = await res.json();
        if (data.ok && data.commitVerified && data.liveUrl) {
          setDeployNote(`Live at ${data.liveUrl.replace(/^https?:\/\//, '')}`);
          setProductionUrl(data.liveUrl);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          onDeploySuccess?.();
        }
      } catch {
        /* ignore */
      }
      if (attempts >= 30) {
        setDeployNote(
          expectedUrl
            ? `Build may still be running. Check ${expectedUrl.replace(/^https?:\/\//, '')}`
            : 'Publish started — check your live site in a minute.'
        );
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 4000);
  };

  const handleBackup = async (options?: { force?: boolean }) => {
    if (saving) return;
    if (mode === 'editor' && !options?.force && !needsSave) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const url =
        mode === 'editor'
          ? `/api/projects/${targetId}/code-agent/save`
          : `/api/projects/clone/jobs/${targetId}/save-preview`;
      const res = await fetch(url, {
        method: 'POST',
        headers: mode === 'editor' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          mode === 'editor' && options?.force
            ? JSON.stringify({ force: true, commitMessage: 'Save preview backup' })
            : undefined,
      });
      const data = await res.json();

      if (data.ok) {
        if (mode === 'clone' && data.projectId) setLastSavedProjectId(data.projectId);
        setSaveSuccess(true);
        setSaveSuccessDetail(
          mode === 'editor'
            ? 'Backup copy saved.'
            : 'Backup copy saved — you can return from your dashboard anytime.'
        );
        onSaveSuccess?.();
        setTimeout(() => {
          setSaveSuccess(false);
          setSaveSuccessDetail(null);
        }, 5000);
      } else {
        setSaveError(data.error || 'Backup failed');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (deployInProgress) return;
    if (!window.confirm(OWNER_COPY.publishConfirm)) return;

    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);
    setDeployNote(null);
    setProductionUrl(null);

    try {
      const url =
        mode === 'editor'
          ? `/api/projects/${targetId}/code-agent/deploy`
          : `/api/projects/clone/jobs/${targetId}/deploy-preview`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        const prodUrl = data.deployment?.liveUrl || data.deployment?.expectedProductionUrl || null;
        setProductionUrl(prodUrl);
        setDeploySuccess(true);
        setDeployNote(
          prodUrl
            ? `Updating ${prodUrl.replace(/^https?:\/\//, '')}…`
            : 'Your live site is being updated.'
        );
        onDeploySuccess?.();
        if (mode === 'editor') pollEditorDeployment(prodUrl);
        setTimeout(() => setDeploySuccess(false), 12000);
      } else {
        setDeployError(data.error || 'Publish failed');
      }
    } catch {
      setDeployError('Network error');
    } finally {
      setDeploying(false);
    }
  };

  if (mode === 'editor' && !hasGitlab) {
    return (
      <Alert variant="warning">
        Publish requires a linked project. Clone or build a site first to enable publishing.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className={cn('text-xs', TEXT.muted)}>
          <strong className={TEXT.primary}>{OWNER_COPY.draftPreview}</strong> is what you see on the
          left. <strong className={TEXT.primary}>{OWNER_COPY.liveWebsite}</strong> is your public
          address after you publish.
        </p>
      )}

      {canBackup && (
        <div className="space-y-2">
          {!compact && <p className={cn('text-xs', TEXT.muted)}>{OWNER_COPY.backupCopyHint}</p>}
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => handleBackup()}
            disabled={saving || backupDisabled}
          >
            {saving ? (
              <>
                <Loading size="sm" />
                Saving backup…
              </>
            ) : (
              OWNER_COPY.backupCopy
            )}
          </Button>
          {mode === 'editor' && !needsSave && (
            <p className={cn('text-xs', TEXT.muted)}>{OWNER_COPY.noUnsaved}</p>
          )}
          {saveSuccess && <Alert variant="success">{saveSuccessDetail || 'Backup saved.'}</Alert>}
          {saveError && <Alert variant="error">{saveError}</Alert>}
        </div>
      )}

      <div className={canBackup ? cn('space-y-2 border-t pt-3', BORDER.hairline) : 'space-y-2'}>
        {!compact && <p className={cn('text-xs', TEXT.muted)}>{OWNER_COPY.publishLiveHint}</p>}
        <Button className="w-full" onClick={handlePublish} disabled={deployInProgress}>
          {deploying ? (
            <>
              <Loading size="sm" />
              Preparing publish…
            </>
          ) : polling || isVercelBuilding ? (
            <>
              <Loading size="sm" />
              Updating live site…
            </>
          ) : (
            OWNER_COPY.publishLive
          )}
        </Button>

        {deploySuccess && (
          <Alert variant="success" className="text-xs">
            <p className="font-medium">Publish started</p>
            {deployNote && <p className="mt-1 opacity-90">{deployNote}</p>}
            {productionUrl && (
              <a
                href={productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('mt-1 block truncate', ACCENT.link, 'hover:underline')}
              >
                Open live site →
              </a>
            )}
          </Alert>
        )}
        {deployError && <Alert variant="error">{deployError}</Alert>}
      </div>

      {mode === 'clone' && projectId && (
        <Link
          href={`/projects/${projectId}`}
          className={cn('block text-center text-xs', TEXT.muted, 'hover:text-[#1d1d1f]')}
        >
          Open editor to keep editing →
        </Link>
      )}
      {gitlabWebUrl && (
        <a
          href={gitlabWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('block text-center text-xs', TEXT.tertiary, 'hover:text-[#6e6e73]')}
        >
          View backup (advanced)
        </a>
      )}
    </div>
  );
}

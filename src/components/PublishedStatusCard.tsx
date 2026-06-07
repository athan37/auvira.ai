'use client';

import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ACCENT, BORDER, TEXT } from '@/content/productTheme';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { ownerDeploymentBadgeLabel, OWNER_COPY } from '@/lib/owner/ownerCopy';

interface Deployment {
  provider?: string;
  status?: string;
  ready?: boolean;
  liveUrl?: string | null;
  deploymentUrl?: string | null;
  inspectorUrl?: string | null;
  vercelProjectName?: string;
  projectId?: string;
  expectedProductionUrl?: string | null;
  lastDeployedCommitSha?: string;
  error?: string;
}

interface Props {
  projectId: string;
  deployment?: Deployment | null;
  lastPublishedAt?: string | null;
  gitlabWebUrl?: string | null;
  onDeploymentUpdate?: () => void;
  /** When false, skip deployment status polling (e.g. tab not visible). Default true. */
  pollingEnabled?: boolean;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function isInProgressStatus(status?: string): boolean {
  return status === 'building' || status === 'pending' || status === 'triggered';
}

export function PublishedStatusCard({
  projectId,
  deployment,
  lastPublishedAt,
  gitlabWebUrl,
  onDeploymentUpdate,
  pollingEnabled = true,
}: Props) {
  const onUpdateRef = useRef(onDeploymentUpdate);
  onUpdateRef.current = onDeploymentUpdate;

  const [polled, setPolled] = useState<{
    status?: string;
    liveUrl?: string | null;
    inspectorUrl?: string | null;
    message?: string;
    commitShaShort?: string | null;
    commitVerified?: boolean;
    contentWarning?: string | null;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const displayStatus = polled?.status || deployment?.status;
  const commitVerified = polled?.commitVerified ?? false;
  const liveUrl = commitVerified
    ? polled?.liveUrl || deployment?.liveUrl || deployment?.expectedProductionUrl || null
    : null;
  const inspectorUrl = polled?.inspectorUrl || deployment?.inspectorUrl;
  const pollNote = polled?.message || null;
  const commitShort =
    polled?.commitShaShort || deployment?.lastDeployedCommitSha?.slice(0, 8) || null;

  const hasVercel = Boolean(deployment?.projectId || deployment?.vercelProjectName);
  const isBuilding = isInProgressStatus(displayStatus) || (displayStatus === 'ready' && !commitVerified);

  useEffect(() => {
    if (!pollingEnabled) return;
    if (!hasVercel) return;
    if (commitVerified && liveUrl) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      setPolling(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/deployment-status`);
        const data = await res.json();
        if (data.ok) {
          const next = {
            status: data.status as string,
            liveUrl: data.liveUrl as string | null,
            inspectorUrl: data.inspectorUrl as string | null,
            message: data.message as string,
            commitShaShort: data.commitShaShort as string | null,
            commitVerified: Boolean(data.commitVerified),
            contentWarning: data.contentWarning as string | null,
          };
          setPolled(next);
          if (next.commitVerified && next.liveUrl) {
            setPollTimedOut(false);
            onUpdateRef.current?.();
          }
        } else if (data.error) {
          setPolled((prev) => ({ ...prev, message: data.error }));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPolling(false);
      }
    };

    poll();
    const interval = setInterval(() => {
      attempts += 1;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        setPollTimedOut(true);
        return;
      }
      poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, hasVercel, deployment?.status, deployment?.liveUrl, commitVerified, liveUrl, pollingEnabled]);

  return (
    <Card>
      <CardHeader>
        <h2 className={cn('font-medium text-sm', TEXT.muted)}>Save & deploy status</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-xs', TEXT.muted)}>Last backup saved</span>
            <span className={cn('text-xs', TEXT.primary)}>{formatRelativeTime(lastPublishedAt)}</span>
          </div>
          {gitlabWebUrl ? (
            <a
              href={gitlabWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('text-xs block truncate', ACCENT.link, 'hover:underline')}
            >
              View backup copy (advanced)
            </a>
          ) : (
            <p className={cn('text-xs', TEXT.muted)}>Save a backup copy before publishing live.</p>
          )}
        </div>

        <div className={cn('border-t pt-3 space-y-2', BORDER.hairline)}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-xs', TEXT.muted)}>{OWNER_COPY.liveWebsite}</span>
            <div className="flex items-center gap-1.5">
              {polling && isBuilding && <Loading size="sm" />}
              <Badge tone={statusToBadgeTone(commitVerified ? 'ready' : displayStatus)}>
                {ownerDeploymentBadgeLabel(displayStatus, commitVerified)}
              </Badge>
            </div>
          </div>

          <p className={cn('text-xs', TEXT.muted)}>
            Use the production URL below after deploy. Old links with random IDs in the URL are
            frozen snapshots and do not update.
          </p>

          {liveUrl && commitVerified ? (
            <>
              {commitShort && (
                <p className={cn('text-xs font-mono', TEXT.muted)}>
                  Deployed commit {commitShort} from your preview
                </p>
              )}
              {polled?.contentWarning && (
                <p className="text-xs text-amber-700">{polled.contentWarning}</p>
              )}
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('text-xs block truncate', ACCENT.link, 'hover:underline')}
              >
                {liveUrl.replace(/^https?:\/\//, '')}
              </a>
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="w-full">
                  Open live site
                </Button>
              </a>
            </>
          ) : hasVercel ? (
            <p className={cn('text-xs', TEXT.muted)}>
              {commitShort && isBuilding && (
                <span className={cn('block font-mono mb-1', TEXT.primary)}>
                  Building commit {commitShort}
                  {deployment?.expectedProductionUrl
                    ? ` → ${deployment.expectedProductionUrl.replace(/^https?:\/\//, '')}`
                    : ''}
                </span>
              )}
              {isBuilding
                ? pollNote || 'Vercel is building your site (usually 1–3 minutes).'
                : pollNote || 'Checking Vercel deployment status…'}
              {pollTimedOut && deployment?.expectedProductionUrl && (
                <span className={cn('block mt-2', TEXT.muted)}>
                  Still waiting? Check{' '}
                  <a
                    href={deployment.expectedProductionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(ACCENT.link, 'hover:underline')}
                  >
                    {deployment.expectedProductionUrl.replace(/^https?:\/\//, '')}
                  </a>{' '}
                  or refresh this page.
                </span>
              )}
            </p>
          ) : (
            <p className={cn('text-xs', TEXT.muted)}>
              Not published yet. Use <strong>Publish live site</strong> when your draft looks right.
            </p>
          )}

          {inspectorUrl && (
            <a
              href={inspectorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('text-xs block', TEXT.muted, ACCENT.link, 'hover:underline')}
            >
              View build logs on Vercel
            </a>
          )}

          {deployment?.error && <p className="text-xs text-red-600">{deployment.error}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

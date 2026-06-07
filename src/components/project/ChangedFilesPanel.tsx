'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  editStatusLabel,
  formatEditJobError,
} from '@/lib/project-workspace/editJobMessages';
import { formatDurationMs } from '@/lib/project-workspace/editTimingShared';
import { BORDER, TEXT } from '@/content/productTheme';
import { Alert } from '@/components/ui/Alert';
import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import EditErrorTrace from '@/components/project/EditErrorTrace';
import { FileDiffViewer } from '@/components/project/FileDiffViewer';

interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}

interface DiffResponse {
  ok: boolean;
  jobId: string | null;
  status: string | null;
  changedFiles: ChangedFile[];
  summary: string | null;
  error: string | null;
  buildLog: string | null;
  logs: Array<{
    type: string;
    message: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  timing?: {
    totalMs: number | null;
    phases: Array<{ phase: string; durationMs: number }>;
    slowestPhase: string | null;
    strategy?: string | null;
    tier?: string | null;
    confidence?: string | null;
  };
}

interface Props {
  projectId: string;
  jobId: string | null;
  refreshKey: number;
  editInProgress?: boolean;
  onRollbackSuccess?: () => void;
  onForceSyncSuccess?: () => void;
}

export function ChangedFilesPanel({
  projectId,
  jobId,
  refreshKey,
  editInProgress,
  onRollbackSuccess,
  onForceSyncSuccess,
}: Props) {
  const [forceSyncing, setForceSyncing] = useState(false);
  const [data, setData] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showAgentLogs, setShowAgentLogs] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackMsg, setRollbackMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  useEffect(() => {
    setExpandedFile(null);
  }, [jobId, refreshKey]);

  useEffect(() => {
    const fetchDiff = async () => {
      setLoading(true);
      try {
        const url = jobId
          ? `/api/projects/${projectId}/code-agent/diff?jobId=${jobId}`
          : `/api/projects/${projectId}/code-agent/diff`;
        const res = await fetch(url);
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [projectId, jobId, refreshKey]);

  if (editInProgress) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3 py-6">
          <Loading size="sm" />
          <p className={cn('text-sm', TEXT.muted)}>Edit in progress…</p>
        </CardBody>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3 py-6">
          <Loading size="sm" />
          <p className={cn('text-sm', TEXT.muted)}>Loading edit details…</p>
        </CardBody>
      </Card>
    );
  }

  if (!data?.jobId) {
    const missingJob = Boolean(jobId);
    return (
      <Card>
        <CardBody className="space-y-2">
          <h3 className={cn('text-sm font-semibold', TEXT.primary)}>Changes</h3>
          {missingJob ? (
            <>
              <Alert variant="warning">
                {data?.error ||
                  'Could not load this edit. Check Chat for the latest message, then try sending your request again.'}
              </Alert>
              <p className={cn('text-xs', TEXT.muted)}>
                Job reference: <span className="font-mono">{jobId}</span>
              </p>
            </>
          ) : (
            <p className={cn('text-xs', TEXT.muted)}>
              After you edit the site in Chat, changed files and undo will appear here.
            </p>
          )}
        </CardBody>
      </Card>
    );
  }

  const changedCount = data.changedFiles.length;
  const statusLabel = editStatusLabel(data.status, changedCount);
  const friendlyError = formatEditJobError(data.error);
  const isFailed = data.status === 'failed';
  const isIncomplete = isFailed && (changedCount > 0 || Boolean(friendlyError));
  const canUndo = data.status === 'ready';
  const errorTraceLog = data.logs?.find((log) => log.type === 'error_trace');
  const errorTrace =
    typeof errorTraceLog?.metadata?.copyText === 'string'
      ? errorTraceLog.metadata.copyText
      : null;
  const errorStage =
    typeof errorTraceLog?.metadata?.stage === 'string' ? errorTraceLog.metadata.stage : undefined;

  const handleRollback = async () => {
    if (!data.jobId || rollingBack) return;
    if (!window.confirm('Undo the latest edit? Your preview will revert to the previous version.')) {
      return;
    }
    setRollingBack(true);
    setRollbackMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/code-agent/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: data.jobId }),
      });
      const json = await res.json();
      if (json.ok) {
        setRollbackMsg({ ok: true, text: 'Edit undone.' });
        onRollbackSuccess?.();
      } else {
        setRollbackMsg({ ok: false, text: json.error || 'Could not undo edit.' });
      }
    } catch {
      setRollbackMsg({ ok: false, text: 'Network error while undoing.' });
    } finally {
      setRollingBack(false);
    }
  };

  const handleSaveToGitLab = async () => {
    if (forceSyncing) return;
    setForceSyncing(true);
    setRollbackMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/code-agent/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, commitMessage: 'Save preview after incomplete edit' }),
      });
      const json = await res.json();
      if (json.ok) {
        setRollbackMsg({
          ok: true,
          text: 'Preview saved to GitLab. Use Deploy when you want to update the live site.',
        });
        onForceSyncSuccess?.();
      } else {
        setRollbackMsg({ ok: false, text: json.error || 'Save to GitLab failed.' });
      }
    } catch {
      setRollbackMsg({ ok: false, text: 'Network error while saving.' });
    } finally {
      setForceSyncing(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn('text-sm font-semibold', TEXT.primary)}>Latest edit</h3>
          <Badge tone={statusToBadgeTone(isIncomplete ? 'incomplete' : data.status)}>
            {statusLabel}
          </Badge>
        </div>

        {isFailed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
            <p className="text-xs font-medium text-amber-950">What happened</p>
            <p className="text-xs text-amber-900 leading-relaxed">
              {friendlyError ||
                'The agent did not finish this edit. Your preview on the left may still show changes.'}
            </p>
            <p className="text-xs font-medium text-amber-950 pt-1">What to do</p>
            <ol className="text-xs text-amber-900 list-decimal list-inside space-y-1 leading-relaxed">
              <li>Check the preview — if it looks correct, use Save to GitLab below.</li>
              <li>Or send another message in Chat to try again.</li>
              <li>Use Deploy when you are ready to publish the live site.</li>
            </ol>
            <Button
              variant="secondary"
              className="w-full mt-1"
              onClick={handleSaveToGitLab}
              disabled={forceSyncing}
            >
              {forceSyncing ? 'Saving to GitLab…' : 'Save to GitLab'}
            </Button>
          </div>
        )}

        {isFailed && errorTrace && (
          <EditErrorTrace trace={errorTrace} jobId={data.jobId ?? undefined} stage={errorStage} />
        )}

        {data.summary && !isFailed && (
          <p className={cn('text-xs', TEXT.muted)}>{data.summary}</p>
        )}

        {data.timing && data.timing.phases.length > 0 && (
          <div className={cn('rounded-lg border px-3 py-2 space-y-1.5 bg-[#f5f5f7]', BORDER.hairline)}>
            <p className={cn('text-xs font-medium', TEXT.primary)}>Edit timing</p>
            {data.timing.totalMs != null && (
              <p className={cn('text-[11px]', TEXT.muted)}>
                Total {formatDurationMs(data.timing.totalMs)}
                {data.timing.slowestPhase
                  ? ` · slowest: ${data.timing.slowestPhase.replace(/_/g, ' ')}`
                  : ''}
                {data.timing.strategy
                  ? ` · ${data.timing.strategy.replace(/_/g, ' ')}${data.timing.tier ? ` (${data.timing.tier})` : ''}`
                  : ''}
              </p>
            )}
            <ul className={cn('text-[11px] space-y-0.5', TEXT.muted)}>
              {data.timing.phases.map((p) => (
                <li key={p.phase} className="flex justify-between gap-2">
                  <span className="capitalize">{p.phase.replace(/_/g, ' ')}</span>
                  <span className={cn('font-mono shrink-0', TEXT.tertiary)}>
                    {formatDurationMs(p.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rollbackMsg && (
          <Alert variant={rollbackMsg.ok ? 'success' : 'error'}>{rollbackMsg.text}</Alert>
        )}

        {changedCount > 0 && (
          <>
            <p className={cn('text-xs font-medium', TEXT.primary)}>
              Files touched ({changedCount})
            </p>
            <ul className="text-xs space-y-1">
              {data.changedFiles.map((f) => {
                const isOpen = expandedFile === f.path;
                return (
                  <li key={f.path} className={cn('rounded-md border bg-white', BORDER.hairline)}>
                    <button
                      type="button"
                      onClick={() => setExpandedFile(isOpen ? null : f.path)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-2 py-1.5 font-mono hover:bg-[#f5f5f7] rounded-md text-left',
                        TEXT.primary
                      )}
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('shrink-0 w-3', TEXT.tertiary)} aria-hidden>
                          {isOpen ? '▾' : '▸'}
                        </span>
                        <span className="truncate">{f.path}</span>
                      </span>
                      <span className={cn('flex-shrink-0 text-[10px]', TEXT.muted)}>
                        {f.status}
                        {f.additions || f.deletions ? (
                          <span className={cn('ml-1', TEXT.tertiary)}>
                            +{f.additions || 0}/-{f.deletions || 0}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {data.jobId && (
                      <div className="px-2 pb-2">
                        <FileDiffViewer
                          projectId={projectId}
                          jobId={data.jobId}
                          filePath={f.path}
                          expanded={isOpen}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {data.buildLog && (
          <div>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className={cn('text-xs hover:underline', TEXT.primary)}
            >
              {showLog ? 'Hide' : 'Show'} build log
            </button>
            {showLog && (
              <pre className={cn('mt-2 text-xs rounded-lg p-2 max-h-32 overflow-auto whitespace-pre-wrap bg-[#f5f5f7] border', BORDER.hairline)}>
                {data.buildLog}
              </pre>
            )}
          </div>
        )}

        {data.logs && data.logs.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAgentLogs((v) => !v)}
              className={cn('text-xs hover:underline', TEXT.primary)}
            >
              {showAgentLogs ? 'Hide' : 'Show'} agent activity
            </button>
            {showAgentLogs && (
              <ul className={cn('mt-2 text-xs space-y-1 max-h-28 overflow-y-auto', TEXT.muted)}>
                {data.logs
                  .filter((log) => log.type !== 'error_trace' && log.type !== 'timing_summary')
                  .map((log, i) => (
                    <li key={i}>
                      <span className={TEXT.tertiary}>{log.type}</span> {log.message}
                      {typeof log.metadata?.durationMs === 'number' ? (
                        <span className={TEXT.tertiary}>
                          {' '}
                          ({formatDurationMs(log.metadata.durationMs as number)})
                        </span>
                      ) : null}
                      {log.type === 'error_detail' && log.metadata?.stage ? (
                        <span className={TEXT.tertiary}> ({String(log.metadata.stage)})</span>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {canUndo && (
          <Button variant="secondary" className="w-full" onClick={handleRollback} disabled={rollingBack}>
            {rollingBack ? 'Undoing…' : 'Undo latest edit'}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

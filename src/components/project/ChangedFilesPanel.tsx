'use client';

import { useEffect, useState } from 'react';
import {
  editStatusLabel,
  formatEditJobError,
} from '@/lib/project-workspace/editJobMessages';
import { formatDurationMs } from '@/lib/project-workspace/editTimingShared';
import { Alert } from '@/components/ui/Alert';
import { Badge, statusToBadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import EditErrorTrace from '@/components/project/EditErrorTrace';

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
          <Spinner size="sm" />
          <p className="text-sm text-zinc-600">Edit in progress…</p>
        </CardBody>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3 py-6">
          <Spinner size="sm" />
          <p className="text-sm text-zinc-500">Loading edit details…</p>
        </CardBody>
      </Card>
    );
  }

  if (!data?.jobId) {
    const missingJob = Boolean(jobId);
    return (
      <Card>
        <CardBody className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">Changes</h3>
          {missingJob ? (
            <>
              <Alert variant="warning">
                {data?.error ||
                  'Could not load this edit. Check Chat for the latest message, then try sending your request again.'}
              </Alert>
              <p className="text-xs text-zinc-500">
                Job reference: <span className="font-mono">{jobId}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
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
          <h3 className="text-sm font-semibold text-zinc-900">Latest edit</h3>
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
          <p className="text-xs text-zinc-600">{data.summary}</p>
        )}

        {data.timing && data.timing.phases.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 space-y-1.5">
            <p className="text-xs font-medium text-zinc-800">Edit timing</p>
            {data.timing.totalMs != null && (
              <p className="text-[11px] text-zinc-500">
                Total {formatDurationMs(data.timing.totalMs)}
                {data.timing.slowestPhase
                  ? ` · slowest: ${data.timing.slowestPhase.replace(/_/g, ' ')}`
                  : ''}
              </p>
            )}
            <ul className="text-[11px] text-zinc-600 space-y-0.5">
              {data.timing.phases.map((p) => (
                <li key={p.phase} className="flex justify-between gap-2">
                  <span className="capitalize">{p.phase.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-zinc-500 shrink-0">
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
            <p className="text-xs font-medium text-zinc-700">
              Files touched ({changedCount})
            </p>
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {data.changedFiles.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center justify-between gap-2 font-mono text-zinc-700"
                >
                  <span className="truncate">{f.path}</span>
                  <span className="flex-shrink-0 text-zinc-500">
                    {f.status}
                    {f.additions || f.deletions ? (
                      <span className="ml-1 text-zinc-400">
                        +{f.additions || 0}/-{f.deletions || 0}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {data.buildLog && (
          <div>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="text-xs text-zinc-950 hover:underline"
            >
              {showLog ? 'Hide' : 'Show'} build log
            </button>
            {showLog && (
              <pre className="mt-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg p-2 max-h-32 overflow-auto whitespace-pre-wrap">
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
              className="text-xs text-zinc-950 hover:underline"
            >
              {showAgentLogs ? 'Hide' : 'Show'} agent activity
            </button>
            {showAgentLogs && (
              <ul className="mt-2 text-xs space-y-1 max-h-28 overflow-y-auto text-zinc-600">
                {data.logs
                  .filter((log) => log.type !== 'error_trace' && log.type !== 'timing_summary')
                  .map((log, i) => (
                    <li key={i}>
                      <span className="text-zinc-400">{log.type}</span> {log.message}
                      {typeof log.metadata?.durationMs === 'number' ? (
                        <span className="text-zinc-400">
                          {' '}
                          ({formatDurationMs(log.metadata.durationMs as number)})
                        </span>
                      ) : null}
                      {log.type === 'error_detail' && log.metadata?.stage ? (
                        <span className="text-zinc-400"> ({String(log.metadata.stage)})</span>
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

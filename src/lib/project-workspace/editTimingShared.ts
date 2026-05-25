/** Client-safe edit timing helpers (no mongoose / server imports). */

export type EditJobLogLike = {
  type: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
};

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const PHASE_PAIRS: Array<{ phase: string; start: string; end: string | string[] }> = [
  { phase: 'workspace_prepare', start: 'workspace_prepare_started', end: 'workspace_prepare_done' },
  { phase: 'agent', start: 'agent_started', end: ['agent_finished'] },
  { phase: 'validation', start: 'validation_started', end: ['validation_passed', 'validation_failed'] },
  { phase: 'preview_restart', start: 'preview_restart_started', end: ['preview_restarted', 'preview_restart_failed'] },
  { phase: 'preview_health', start: 'preview_health_started', end: ['preview_health_ok', 'preview_health_slow'] },
  { phase: 'preview_verify', start: 'preview_verify_started', end: ['preview_content_verified', 'preview_content_missing'] },
];

function findLogTime(logs: EditJobLogLike[], type: string): number | null {
  const entry = logs.find((l) => l.type === type);
  if (!entry?.createdAt) return null;
  return new Date(entry.createdAt).getTime();
}

/** Build timing summary from stored job logs (for diff API / UI). */
export function buildEditTimingFromLogs(logs: EditJobLogLike[]): {
  totalMs: number | null;
  phases: Array<{ phase: string; durationMs: number }>;
  slowestPhase: string | null;
} {
  const withDuration = logs
    .filter((l) => typeof l.metadata?.durationMs === 'number')
    .map((l) => ({
      phase: String(l.metadata?.phase ?? l.type),
      durationMs: l.metadata!.durationMs as number,
    }));

  if (withDuration.length > 0) {
    const sorted = [...withDuration].sort((a, b) => b.durationMs - a.durationMs);
    const totalFromSummary = logs.find((l) => l.type === 'timing_summary')?.metadata?.totalMs;
    return {
      totalMs: typeof totalFromSummary === 'number' ? totalFromSummary : null,
      phases: sorted,
      slowestPhase: sorted[0]?.phase ?? null,
    };
  }

  const phases: Array<{ phase: string; durationMs: number }> = [];
  for (const { phase, start, end } of PHASE_PAIRS) {
    const startMs = findLogTime(logs, start);
    if (startMs == null) continue;
    const endTypes = Array.isArray(end) ? end : [end];
    let endMs: number | null = null;
    for (const t of endTypes) {
      const ms = findLogTime(logs, t);
      if (ms != null) {
        endMs = ms;
        break;
      }
    }
    if (endMs != null && endMs >= startMs) {
      phases.push({ phase, durationMs: endMs - startMs });
    }
  }

  phases.sort((a, b) => b.durationMs - a.durationMs);

  const created = findLogTime(logs, 'job_created');
  const finished =
    findLogTime(logs, 'preview_ready') ??
    findLogTime(logs, 'timing_summary') ??
    (logs.length ? new Date(logs[logs.length - 1].createdAt).getTime() : null);

  return {
    totalMs: created != null && finished != null ? finished - created : null,
    phases,
    slowestPhase: phases[0]?.phase ?? null,
  };
}

import { appendEditJobLog } from './editJobLogger';

export { formatDurationMs, buildEditTimingFromLogs } from './editTimingShared';
export type { EditJobLogLike } from './editTimingShared';

/** Tracks per-phase durations for one edit job. */
export class EditStepTimer {
  private readonly jobStartMs = Date.now();
  private readonly phaseStarts = new Map<string, number>();
  private readonly phaseDurations = new Map<string, number>();

  /** Mark the start of a timed phase (e.g. `agent`, `validation`). */
  start(phase: string): void {
    this.phaseStarts.set(phase, Date.now());
  }

  /** Record elapsed ms for a phase and return it. */
  finish(phase: string): number {
    const started = this.phaseStarts.get(phase);
    const durationMs = started != null ? Date.now() - started : 0;
    this.phaseDurations.set(phase, durationMs);
    this.phaseStarts.delete(phase);
    return durationMs;
  }

  totalMs(): number {
    return Date.now() - this.jobStartMs;
  }

  /** All finished phase durations, sorted slowest first. */
  summary(): Array<{ phase: string; durationMs: number }> {
    return [...this.phaseDurations.entries()]
      .map(([phase, durationMs]) => ({ phase, durationMs }))
      .sort((a, b) => b.durationMs - a.durationMs);
  }

  slowest(): { phase: string; durationMs: number } | null {
    const items = this.summary();
    return items[0] ?? null;
  }
}

/** Append edit job log with durationMs in metadata. */
export async function appendTimedEditJobLog(
  jobId: string,
  type: string,
  message: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await appendEditJobLog(jobId, type, message, {
    ...metadata,
    durationMs,
  });
}

/** Log a timing summary row at end of edit (success or fail). */
export async function logEditTimingSummary(
  jobId: string,
  timer: EditStepTimer
): Promise<void> {
  const phases = timer.summary();
  const slowest = timer.slowest();
  await appendEditJobLog(jobId, 'timing_summary', 'Edit timing breakdown', {
    totalMs: timer.totalMs(),
    phases,
    slowestPhase: slowest?.phase,
    slowestMs: slowest?.durationMs,
  });
}

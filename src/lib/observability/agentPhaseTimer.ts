/** Tracks per-phase durations inside the edit agent (plan, execute, etc.). */
export class AgentPhaseTimer {
  private readonly phaseStarts = new Map<string, number>();
  private readonly phaseDurations = new Map<string, number>();

  /** Mark the start of a timed phase. */
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

  /** All finished phase durations, sorted slowest first. */
  summary(): Array<{ phase: string; durationMs: number }> {
    return [...this.phaseDurations.entries()]
      .map(([phase, durationMs]) => ({ phase, durationMs }))
      .sort((a, b) => b.durationMs - a.durationMs);
  }

  /** Merge into a latency breakdown map (prefixes agent phases). */
  toLatencyBreakdown(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const { phase, durationMs } of this.summary()) {
      out[phase] = durationMs;
    }
    return out;
  }
}

/** Merge route-level and agent-level latency maps (agent keys win on collision). */
export function mergeLatencyBreakdown(
  route: Record<string, number>,
  agent: Record<string, number>
): Record<string, number> {
  return { ...route, ...agent };
}

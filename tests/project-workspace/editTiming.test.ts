import { describe, expect, it } from 'vitest';
import {
  EditStepTimer,
  buildEditTimingFromLogs,
  formatDurationMs,
} from '../../src/lib/project-workspace/editTiming';

describe('editTiming', () => {
  it('formatDurationMs', () => {
    expect(formatDurationMs(450)).toBe('450ms');
    expect(formatDurationMs(3200)).toBe('3.2s');
  });

  it('EditStepTimer tracks phases', () => {
    const timer = new EditStepTimer();
    timer.start('agent');
    timer.finish('agent');
    timer.start('validation');
    timer.finish('validation');
    const summary = timer.summary();
    expect(summary.length).toBe(2);
  });

  it('buildEditTimingFromLogs uses durationMs metadata', () => {
    const timing = buildEditTimingFromLogs([
      {
        type: 'agent_finished',
        createdAt: new Date(),
        metadata: { durationMs: 5000, phase: 'agent' },
      },
      {
        type: 'validation_passed',
        createdAt: new Date(),
        metadata: { durationMs: 1200, phase: 'validation' },
      },
      {
        type: 'timing_summary',
        createdAt: new Date(),
        metadata: { totalMs: 8000 },
      },
    ]);
    expect(timing.totalMs).toBe(8000);
    expect(timing.slowestPhase).toBe('agent');
    expect(timing.phases[0]?.durationMs).toBe(5000);
  });

  it('buildEditTimingFromLogs falls back to log timestamps', () => {
    const t0 = Date.now();
    const timing = buildEditTimingFromLogs([
      { type: 'job_created', createdAt: new Date(t0), metadata: {} },
      { type: 'agent_started', createdAt: new Date(t0 + 100), metadata: {} },
      { type: 'agent_finished', createdAt: new Date(t0 + 3100), metadata: {} },
      { type: 'preview_ready', createdAt: new Date(t0 + 5000), metadata: {} },
    ]);
    expect(timing.phases.find((p) => p.phase === 'agent')?.durationMs).toBe(3000);
    expect(timing.totalMs).toBe(5000);
  });
});

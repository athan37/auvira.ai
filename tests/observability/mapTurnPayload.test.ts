import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import { mapTurnPayload } from '@/lib/observability/mapTurnPayload';

describe('mapTurnPayload', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = env;
  });

  it('maps success outcome with latency phases', () => {
    const timer = new EditStepTimer();
    timer.start('agent');
    timer.finish('agent');

    const payload = mapTurnPayload({
      turnId: 'job-1',
      turnIndex: 2,
      userMessage: 'Make hero darker',
      reply: 'Updated hero background.',
      outcome: 'success',
      verifyPass: true,
      buildGatePass: true,
      changedFiles: ['src/lib/siteConfig.ts'],
      editTimer: timer,
      coachingContext: null,
    });

    expect(payload.outcome).toBe('success');
    expect(payload.turn_index).toBe(2);
    expect(payload.experiment_variant).toBe('control');
    expect(payload.coaching_applied).toBe(false);
    expect(payload.latency_breakdown_ms?.agent).toBeGreaterThanOrEqual(0);
  });

  it('marks coached variant when coaching flag and hints are present', () => {
    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    const timer = new EditStepTimer();

    const payload = mapTurnPayload({
      turnId: 'job-2',
      turnIndex: 3,
      userMessage: 'Fix build',
      reply: 'Fixed TypeScript errors.',
      outcome: 'success',
      editTimer: timer,
      coachingContext: {
        coachingHints: ['Prior turn failed build gate'],
        constraints: { require_build_gate_pass: true },
        qualitySnapshot: {},
        recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
        source: 'phoenix_traces',
      },
    });

    expect(payload.experiment_variant).toBe('coached');
    expect(payload.coaching_applied).toBe(true);
    expect(payload.coaching_hint_count).toBe(1);
  });
});

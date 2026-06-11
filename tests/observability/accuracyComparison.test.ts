import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlanEditSystemPrompt } from '@/lib/project-workspace/planner/planEditPrompt';
import { isObservabilityCoachingEnabled, isObservabilityEnabled } from '@/lib/observability/config';
import { mapTurnPayload } from '@/lib/observability/mapTurnPayload';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';

const BASE_ENV = { ...process.env };

const SAMPLE_COACHING: ObservabilityCoachingContext = {
  coachingHints: ['Prior turn failed build gate — ensure TypeScript compiles before replying.'],
  constraints: { require_build_gate_pass: true, require_verify_pass: true },
  qualitySnapshot: { latestGrade: 'C', latestOverallScore: 0.62 },
  recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
  missingKeywords: [],
  source: 'phoenix_traces',
};

/** Local mirror of monitor outcome/gate weighting for unit expectations. */
function estimateTurnAccuracyScore(input: {
  outcome: 'success' | 'failed' | 'clarification';
  verifyPass?: boolean;
  buildGatePass?: boolean;
}): number {
  let score = input.outcome === 'success' ? 1 : input.outcome === 'clarification' ? 0.85 : 0;
  if (input.verifyPass === false) score *= 0.5;
  if (input.buildGatePass === false) score *= 0.5;
  return score;
}

describe('observability accuracy — ENABLED=0 vs observe-only ENABLED=1', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it('OBSERVABILITY_ENABLED=0 and observe-only ENABLED=1 use the same planner prompt (no accuracy delta)', () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    const disabledPrompt = buildPlanEditSystemPrompt(null);

    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';

    expect(isObservabilityEnabled()).toBe(true);
    expect(isObservabilityCoachingEnabled()).toBe(false);

    const observeOnlyPrompt = buildPlanEditSystemPrompt(null);
    expect(observeOnlyPrompt).toBe(disabledPrompt);
  });

  it('coaching ENABLED=1 changes planner prompt (accuracy intervention path)', () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';

    const controlPrompt = buildPlanEditSystemPrompt(null);
    const coachedPrompt = buildPlanEditSystemPrompt(SAMPLE_COACHING);

    expect(coachedPrompt).not.toBe(controlPrompt);
    expect(coachedPrompt).toContain('Coaching from prior edits');
    expect(coachedPrompt).toContain('build gate');
  });

  it('failed turns score lower than successful gated turns (accuracy model)', () => {
    const failed = estimateTurnAccuracyScore({
      outcome: 'failed',
      verifyPass: false,
      buildGatePass: false,
    });
    const success = estimateTurnAccuracyScore({
      outcome: 'success',
      verifyPass: true,
      buildGatePass: true,
    });

    expect(success).toBeGreaterThan(failed);
    expect(failed).toBe(0);
    expect(success).toBe(1);
  });

  it('labels experiment arm for accuracy tracking (control vs coached)', () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
    process.env.OBSERVABILITY_API_KEY = 'test-key';

    const controlPayload = mapTurnPayload({
      turnId: 't1',
      turnIndex: 1,
      userMessage: 'test',
      reply: 'ok',
      outcome: 'success',
      editTimer: new EditStepTimer(),
      coachingContext: SAMPLE_COACHING,
    });
    expect(controlPayload.experiment_variant).toBe('control');
    expect(controlPayload.coaching_applied).toBe(false);

    process.env.OBSERVABILITY_COACHING_ENABLED = '1';
    const coachedPayload = mapTurnPayload({
      turnId: 't2',
      turnIndex: 2,
      userMessage: 'test',
      reply: 'ok',
      outcome: 'success',
      editTimer: new EditStepTimer(),
      coachingContext: SAMPLE_COACHING,
    });
    expect(coachedPayload.experiment_variant).toBe('coached');
    expect(coachedPayload.coaching_applied).toBe(true);
  });
});

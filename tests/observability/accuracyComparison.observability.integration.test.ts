import { afterEach, beforeEach, expect, it } from 'vitest';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  ensureObservabilityRegistration,
  fetchCoachingContext,
  recordEditTurn,
} from '@/lib/observability';
import {
  OBSERVABILITY_INTEGRATION_TIMEOUT_MS,
  observabilityIntegrationDescribe,
} from './testGate';

const BASE_ENV = { ...process.env };
const ACCURACY_PROJECT_ID = 'vitest-observability-accuracy';

observabilityIntegrationDescribe('observability accuracy — live monitor turn scores', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV };
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    process.env.OBSERVABILITY_API_URL =
      process.env.OBSERVABILITY_API_URL?.trim() ||
      'https://la-mue-site-monitor-production.up.railway.app';
    process.env.OBSERVABILITY_TIMEOUT_MS = '15000';
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it(
    'failed gated turn scores lower than successful gated turn (ENABLED=1 recording)',
    async () => {
      await ensureObservabilityRegistration({
        projectId: ACCURACY_PROJECT_ID,
        title: 'Vitest accuracy comparison',
      });

      const timer = new EditStepTimer();

      const failedMeta = await recordEditTurn({
        projectId: ACCURACY_PROJECT_ID,
        turnId: `vitest-failed-${Date.now()}`,
        turnIndex: 1,
        userMessage: 'Add broken typescript edit',
        reply: 'Edit failed validation.',
        outcome: 'failed',
        verifyPass: false,
        buildGatePass: false,
        changedFiles: ['src/lib/siteConfig.ts'],
        editTimer: timer,
      });

      const successMeta = await recordEditTurn({
        projectId: ACCURACY_PROJECT_ID,
        turnId: `vitest-success-${Date.now()}`,
        turnIndex: 2,
        userMessage: 'Fix hero headline copy',
        reply: 'Updated hero headline.',
        outcome: 'success',
        verifyPass: true,
        buildGatePass: true,
        changedFiles: ['src/lib/siteConfig.ts'],
        editTimer: timer,
      });

      const failedScore = failedMeta?.arize.overallScore ?? 0;
      const successScore = successMeta?.arize.overallScore ?? 0;

      expect(failedMeta?.arize.syncStatus).toBe('synced');
      expect(successMeta?.arize.syncStatus).toBe('synced');
      expect(failedMeta?.arize.externalId).toBeTruthy();
      expect(successMeta?.arize.externalId).toBeTruthy();
      expect(successScore).toBeGreaterThan(failedScore);

      // eslint-disable-next-line no-console -- accuracy report for operator
      console.info('[observability accuracy]', {
        OBSERVABILITY_ENABLED: '1',
        failedOverall: failedScore,
        failedGrade: failedMeta?.arize.grade,
        successOverall: successScore,
        successGrade: successMeta?.arize.grade,
        delta: Math.round((successScore - failedScore) * 1000) / 1000,
      });
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );

  it(
    'after failed turn, context returns coaching hints for retry accuracy',
    async () => {
      await ensureObservabilityRegistration({
        projectId: ACCURACY_PROJECT_ID,
        title: 'Vitest accuracy comparison',
      });

      const timer = new EditStepTimer();
      await recordEditTurn({
        projectId: ACCURACY_PROJECT_ID,
        turnId: `vitest-failed-context-${Date.now()}`,
        turnIndex: 3,
        userMessage: 'Ship broken build',
        reply: 'Build gate failed.',
        outcome: 'failed',
        verifyPass: false,
        buildGatePass: false,
        editTimer: timer,
      });

      const context = await fetchCoachingContext({
        projectId: ACCURACY_PROJECT_ID,
        userMessage: 'Retry the edit safely',
      });

      expect(context?.coachingHints.length ?? 0).toBeGreaterThanOrEqual(0);

      // eslint-disable-next-line no-console -- accuracy report for operator
      console.info('[observability coaching context]', {
        hintCount: context?.coachingHints.length ?? 0,
        recurringIssues: context?.recurringIssues ?? [],
        source: context?.source,
        sampleHint: context?.coachingHints[0] ?? null,
      });
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );
});

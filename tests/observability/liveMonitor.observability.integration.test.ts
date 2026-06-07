import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  ensureObservabilityRegistration,
  fetchCoachingContext,
  isObservabilityEnabled,
  recordEditTurn,
} from '@/lib/observability';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  OBSERVABILITY_INTEGRATION_TIMEOUT_MS,
  observabilityIntegrationDescribe,
} from './testGate';

const BASE_ENV = { ...process.env };
const LIVE_PROJECT_ID = 'vitest-observability-smoke';

observabilityIntegrationDescribe('live Site Monitor (OBSERVABILITY_ENABLED=0 vs 1)', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV };
    process.env.OBSERVABILITY_API_URL =
      process.env.OBSERVABILITY_API_URL?.trim() ||
      'https://la-mue-site-monitor-production.up.railway.app';
    process.env.OBSERVABILITY_COACHING_ENABLED = '0';
    process.env.OBSERVABILITY_TIMEOUT_MS = '10000';
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
    vi.restoreAllMocks();
  });

  it(
    'ENABLED=0 skips monitor recording (baseline edit path)',
    async () => {
      process.env.OBSERVABILITY_ENABLED = '0';

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      expect(isObservabilityEnabled()).toBe(false);

      const meta = await recordEditTurn({
        projectId: LIVE_PROJECT_ID,
        turnId: `vitest-off-${Date.now()}`,
        turnIndex: 1,
        userMessage: 'Smoke test off',
        reply: 'No sidecar.',
        outcome: 'success',
        editTimer: new EditStepTimer(),
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(meta).toBeNull();
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );

  it(
    'ENABLED=1 hits live monitor register + context + record turn',
    async () => {
      process.env.OBSERVABILITY_ENABLED = '1';

      expect(isObservabilityEnabled()).toBe(true);

      const turnId = `vitest-on-${Date.now()}`;
      const userMessage = 'Vitest live observability smoke';

      await ensureObservabilityRegistration({
        projectId: LIVE_PROJECT_ID,
        title: 'Vitest observability smoke',
      });
      const coachingContext = await fetchCoachingContext({
        projectId: LIVE_PROJECT_ID,
        userMessage,
      });
      const timer = new EditStepTimer();
      const meta = await recordEditTurn({
        projectId: LIVE_PROJECT_ID,
        turnId,
        turnIndex: 1,
        userMessage,
        reply: 'Live smoke turn recorded.',
        outcome: 'success',
        verifyPass: true,
        buildGatePass: true,
        changedFiles: [],
        editTimer: timer,
        coachingContext,
      });

      expect(meta).not.toBeNull();
      expect(meta?.arize.syncStatus).toBe('synced');
      expect(meta?.arize.externalId).toBeTruthy();
      expect(meta?.arize.overallScore).toBeDefined();

      // eslint-disable-next-line no-console -- live accuracy smoke for operator
      console.info('[observability live]', {
        OBSERVABILITY_ENABLED: '1',
        traceId: meta?.arize.externalId,
        overallScore: meta?.arize.overallScore,
        grade: meta?.arize.grade,
        hintCount: coachingContext?.coachingHints.length ?? 0,
      });
    },
    OBSERVABILITY_INTEGRATION_TIMEOUT_MS
  );
});

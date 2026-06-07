import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  ensureObservabilityRegistration,
  fetchCoachingContext,
  isObservabilityEnabled,
  recordEditTurn,
} from '@/lib/observability';

const BASE_ENV = { ...process.env };

function applyObservabilityEnv(enabled: '0' | '1') {
  process.env.OBSERVABILITY_ENABLED = enabled;
  process.env.OBSERVABILITY_COACHING_ENABLED = '0';
  process.env.OBSERVABILITY_API_URL =
    process.env.OBSERVABILITY_API_URL ?? 'https://la-mue-site-monitor-production.up.railway.app';
  process.env.OBSERVABILITY_API_KEY =
    process.env.OBSERVABILITY_API_KEY ?? 'test-key-for-mocked-fetch';
  process.env.OBSERVABILITY_TIMEOUT_MS = '5000';
}

/** Mirrors the per-edit observability sidecar path in edit/stream/route.ts. */
async function runEditObservabilitySidecar(input: {
  projectId: string;
  projectTitle: string;
  userMessage: string;
  turnId: string;
  turnIndex: number;
  reply: string;
}) {
  await ensureObservabilityRegistration({
    projectId: input.projectId,
    title: input.projectTitle,
  });
  const coachingContext = await fetchCoachingContext({
    projectId: input.projectId,
    userMessage: input.userMessage,
  });
  const timer = new EditStepTimer();
  const meta = await recordEditTurn({
    projectId: input.projectId,
    turnId: input.turnId,
    turnIndex: input.turnIndex,
    userMessage: input.userMessage,
    reply: input.reply,
    outcome: 'success',
    verifyPass: true,
    buildGatePass: true,
    changedFiles: ['src/lib/siteConfig.ts'],
    editTimer: timer,
    coachingContext,
  });
  return { coachingContext, meta };
}

function mockMonitorFetch(networkDelayMs: number) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    await new Promise((resolve) => setTimeout(resolve, networkDelayMs));
    const url = String(input);

    if (url.includes('/health')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes('/context')) {
      return new Response(
        JSON.stringify({
          context: {
            coaching_hints: ['Prior turn failed build gate — verify TypeScript compiles.'],
            constraints: { require_build_gate_pass: true },
            quality_snapshot: { latest_grade: 'B' },
            recurring_issues: ['EDIT_BUILD_GATE_FAILED'],
            source: 'phoenix_traces',
          },
        }),
        { status: 200 }
      );
    }
    if (url.includes('/turns')) {
      return new Response(
        JSON.stringify({
          turn_id: 'mock-turn',
          trace_id: 'mock-trace-id-abc',
          created: true,
          turn_scores: { overall: 0.91, grade: 'A' },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

describe('OBSERVABILITY_ENABLED flag behavior (mocked monitor)', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
    vi.restoreAllMocks();
  });

  it('OBSERVABILITY_ENABLED=0 skips all monitor HTTP calls', async () => {
    applyObservabilityEnv('0');
    const fetchSpy = mockMonitorFetch(0);

    expect(isObservabilityEnabled()).toBe(false);

    const meta = await runEditObservabilitySidecar({
      projectId: 'proj-flag-off',
      projectTitle: 'Flag off',
      userMessage: 'Make hero darker',
      turnId: 'job-off-1',
      turnIndex: 1,
      reply: 'Updated hero.',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meta.meta).toBeNull();
    expect(meta.coachingContext).toBeNull();
  });

  it('OBSERVABILITY_ENABLED=1 registers, fetches context, and records turn', async () => {
    applyObservabilityEnv('1');
    const fetchSpy = mockMonitorFetch(0);

    expect(isObservabilityEnabled()).toBe(true);

    const { coachingContext, meta } = await runEditObservabilitySidecar({
      projectId: 'proj-flag-on',
      projectTitle: 'Flag on',
      userMessage: 'Add pricing section',
      turnId: 'job-on-1',
      turnIndex: 1,
      reply: 'Added pricing.',
    });

    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(coachingContext?.coachingHints.length).toBeGreaterThan(0);
    expect(meta?.arize.syncStatus).toBe('synced');
    expect(meta?.arize.externalId).toBe('mock-trace-id-abc');
  });

  it('monitor failures never throw when ENABLED=1', async () => {
    applyObservabilityEnv('1');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(
      runEditObservabilitySidecar({
        projectId: 'proj-fail-safe',
        projectTitle: 'Fail safe',
        userMessage: 'Change footer',
        turnId: 'job-fail-1',
        turnIndex: 1,
        reply: 'Changed footer.',
      })
    ).resolves.toBeDefined();
  });
});

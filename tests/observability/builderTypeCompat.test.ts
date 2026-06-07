import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import {
  MONITOR_SUPPORTED_BUILDER_TYPES,
  normalizeObservabilityBuilderType,
} from '@/lib/observability/normalizeObservabilityBuilderType';
import { mapTurnPayload } from '@/lib/observability/mapTurnPayload';
import { recordObservabilityTurn } from '@/lib/observability/recordObservabilityTurn';

describe('normalizeObservabilityBuilderType', () => {
  it('passes la_mue_edit through unchanged', () => {
    const result = normalizeObservabilityBuilderType({ requested: 'la_mue_edit' });
    expect(result.builderType).toBe('la_mue_edit');
    expect(result.flowType).toBe('edit');
    expect(result.usedFallback).toBe(false);
  });

  it('falls back clone/generate to la_mue_edit with flowType preserved', () => {
    const clone = normalizeObservabilityBuilderType({ requested: 'la_mue_clone' });
    expect(clone.builderType).toBe('la_mue_edit');
    expect(clone.flowType).toBe('clone');
    expect(clone.usedFallback).toBe(true);

    const generate = normalizeObservabilityBuilderType({ requested: 'la_mue_generate' });
    expect(generate.builderType).toBe('la_mue_edit');
    expect(generate.flowType).toBe('generate');
    expect(generate.usedFallback).toBe(true);
  });

  it('uses extended supported list when monitor adds enum values', () => {
    const result = normalizeObservabilityBuilderType({
      requested: 'la_mue_clone',
      supported: [...MONITOR_SUPPORTED_BUILDER_TYPES, 'la_mue_clone'],
    });
    expect(result.builderType).toBe('la_mue_clone');
    expect(result.usedFallback).toBe(false);
  });
});

describe('mapTurnPayload flow metadata', () => {
  it('serializes flow_type into plan for clone requests', () => {
    const timer = new EditStepTimer();
    const payload = mapTurnPayload({
      turnId: 't1',
      turnIndex: 1,
      userMessage: 'Build preview',
      reply: 'ok',
      outcome: 'success',
      editTimer: timer,
      requestedBuilderType: 'la_mue_clone',
      clonePhase: 'process',
    });
    expect(payload.builder_type).toBe('la_mue_edit');
    expect(payload.plan?.flow_type).toBe('clone');
    expect(payload.plan?.clone_phase).toBe('process');
  });
});

describe('recordObservabilityTurn 422 handling', () => {
  const BASE_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...BASE_ENV };
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    process.env.OBSERVABILITY_API_URL = 'https://monitor.example.com';
  });

  afterEach(() => {
    process.env = BASE_ENV;
    vi.restoreAllMocks();
  });

  it('returns syncStatus failed and does not throw on POST /turns 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'validation error' }), { status: 422 })
    );

    const timer = new EditStepTimer();
    const meta = await recordObservabilityTurn({
      projectId: 'proj-422',
      turnId: 'turn-422',
      turnIndex: 1,
      userMessage: 'test',
      reply: 'reply',
      outcome: 'success',
      editTimer: timer,
      requestedBuilderType: 'la_mue_clone',
    });

    expect(meta?.arize.syncStatus).toBe('failed');
    expect(meta?.observability?.flowType).toBe('clone');
  });
});

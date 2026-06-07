import { describe, expect, it } from 'vitest';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import { mapTurnPayload } from '@/lib/observability/mapTurnPayload';

describe('mapTurnPayload clone/generation fields', () => {
  it('maps fidelity and build gate fields for clone process turn', () => {
    const timer = new EditStepTimer();
    const payload = mapTurnPayload({
      turnId: 'job-process',
      turnIndex: 1,
      userMessage: 'Generate site plan from https://example.com',
      reply: 'Fidelity passed',
      outcome: 'success',
      verifyPass: true,
      editTimer: timer,
      requestedBuilderType: 'la_mue_clone',
      clonePhase: 'process',
      phaseEvents: [
        { name: 'site_spec_llm', durationMs: 0, outcome: 'success' },
        { name: 'content_fidelity', durationMs: 0, outcome: 'passed' },
      ],
    });

    expect(payload.builder_type).toBe('la_mue_edit');
    expect(payload.verify_pass).toBe(true);
    expect(payload.plan?.flow_type).toBe('clone');
    expect(payload.plan?.clone_phase).toBe('process');
    expect(Array.isArray(payload.plan?.phase_events)).toBe(true);
  });

  it('maps build gate for build-preview turn', () => {
    const timer = new EditStepTimer();
    const payload = mapTurnPayload({
      turnId: 'job-build',
      turnIndex: 2,
      userMessage: 'Build preview',
      reply: 'Gate passed',
      outcome: 'success',
      buildGatePass: true,
      editTimer: timer,
      requestedBuilderType: 'la_mue_clone',
      clonePhase: 'build-preview',
      latencyMs: 4500,
    });

    expect(payload.build_gate_pass).toBe(true);
    expect(payload.latency_ms).toBe(4500);
  });
});

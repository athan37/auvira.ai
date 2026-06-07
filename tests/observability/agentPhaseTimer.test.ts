import { describe, expect, it } from 'vitest';
import { AgentPhaseTimer, mergeLatencyBreakdown } from '@/lib/observability/agentPhaseTimer';
import { EditStepTimer } from '@/lib/project-workspace/editTiming';
import { mapTurnPayload } from '@/lib/observability/mapTurnPayload';

describe('AgentPhaseTimer', () => {
  it('records phase durations', () => {
    const timer = new AgentPhaseTimer();
    timer.start('agent_plan');
    timer.finish('agent_plan');
    expect(timer.toLatencyBreakdown().agent_plan).toBeGreaterThanOrEqual(0);
  });

  it('mergeLatencyBreakdown prefers agent keys on collision', () => {
    const merged = mergeLatencyBreakdown({ agent: 100 }, { agent: 50, agent_plan: 20 });
    expect(merged.agent).toBe(50);
    expect(merged.agent_plan).toBe(20);
  });
});

describe('mapTurnPayload agent sub-phases', () => {
  it('merges agent latency into breakdown and planner_path in plan', () => {
    const routeTimer = new EditStepTimer();
    routeTimer.start('agent');
    routeTimer.finish('agent');

    const payload = mapTurnPayload({
      turnId: 'j1',
      turnIndex: 1,
      userMessage: 'hero',
      reply: 'done',
      outcome: 'success',
      editTimer: routeTimer,
      agentLatencyBreakdown: { agent_plan: 120, agent_execute: 340 },
      plannerPath: 'llm',
    });

    expect(payload.latency_breakdown_ms?.agent_plan).toBe(120);
    expect(payload.latency_breakdown_ms?.agent_execute).toBe(340);
    expect(payload.plan?.planner_path).toBe('llm');
    expect(payload.plan?.flow_type).toBe('edit');
  });
});

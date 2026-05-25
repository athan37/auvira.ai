import { describe, it, expect, vi, afterEach } from 'vitest';
import { routeEditRequest } from '../src/lib/project-workspace/website-edit-agent/intentRouter';

describe('routeEditRequest', () => {
  it('routes blue background to single_shot', () => {
    const d = routeEditRequest('change to blue background');
    expect(d.strategy).toBe('single_shot');
  });

  it('routes add section to agent_loop', () => {
    const d = routeEditRequest('add a testimonials section');
    expect(d.strategy).toBe('agent_loop');
  });
});

describe('checkAdkAgentHealth (deprecated stub)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok for TS-only path', async () => {
    const { checkAdkAgentHealth } = await import(
      '../src/lib/project-workspace/websiteEditRunner'
    );
    const result = await checkAdkAgentHealth();
    expect(result.ok).toBe(true);
  });
});

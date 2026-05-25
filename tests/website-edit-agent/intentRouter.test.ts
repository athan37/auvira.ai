import { describe, it, expect } from 'vitest';
import { routeEditRequest } from '../../src/lib/project-workspace/website-edit-agent/intentRouter';

describe('intentRouter', () => {
  it('routes blue background to single_shot', () => {
    const d = routeEditRequest('change to blue background');
    expect(d.intent).toBe('style');
    expect(d.strategy).toBe('single_shot');
  });

  it('routes add section to agent_loop', () => {
    const d = routeEditRequest('add a testimonials section');
    expect(d.intent).toBe('section');
    expect(d.strategy).toBe('agent_loop');
  });

  it('routes hero headline to agent_loop', () => {
    const d = routeEditRequest('change the hero headline');
    expect(d.strategy).toBe('agent_loop');
  });
});

import '../../llmTestGate';
import { it, expect, afterEach } from 'vitest';
import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { describeLlmIntegration } from './llmTestConfig';
import { setupTestWorkspace } from './setupTestWorkspace';

const HERO_PROMPT =
  "Change the hero headline to 'Premium HVAC Service in Houston' and CTA to 'Schedule Service'";

describeLlmIntegration('Website Agent V2 — planEdit hero routing (LLM integration)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it('routes hero copy changes without clarification', async () => {
    const ws = await setupTestWorkspace();
    cleanup = ws.cleanup;

    const siteModel = await getSiteModel({
      workspacePath: ws.workspacePath,
      gateway: ws.gateway,
      mode: 'gitlab',
    });

    const result = await planEdit({ siteModel, userPrompt: HERO_PROMPT });
    expect(result.ok, result.error).toBe(true);
    const plan = result.plan!;

    expect(plan.needsClarification).toBe(false);
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);

    const heroSkills = plan.steps.filter((s) =>
      ['update_hero', 'update_section_copy'].includes(s.skill)
    );
    expect(heroSkills.length).toBeGreaterThanOrEqual(1);

    const serialized = JSON.stringify(
      heroSkills.map((s) => ({ target: s.target, params: s.params }))
    ).toLowerCase();
    expect(
      serialized.includes('headline') ||
        serialized.includes('cta') ||
        serialized.includes('premium hvac') ||
        serialized.includes('schedule service')
    ).toBe(true);
  });
});

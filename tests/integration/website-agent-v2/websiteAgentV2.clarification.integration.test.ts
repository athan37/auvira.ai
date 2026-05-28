import '../../llmTestGate';
import { it, expect, afterEach } from 'vitest';
import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { describeLlmIntegration } from './llmTestConfig';
import { setupTestWorkspace } from './setupTestWorkspace';

const AMBIGUOUS_PROMPTS = ['Make that section better', 'Make the blue section better'];

describeLlmIntegration('Website Agent V2 — planEdit clarification (LLM integration)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it.each(AMBIGUOUS_PROMPTS)('asks for clarification when prompt is vague: %s', async (userPrompt) => {
    const ws = await setupTestWorkspace();
    cleanup = ws.cleanup;

    const siteModel = await getSiteModel({
      workspacePath: ws.workspacePath,
      gateway: ws.gateway,
      mode: 'gitlab',
    });

    const result = await planEdit({ siteModel, userPrompt });
    expect(result.ok, result.error).toBe(true);
    const plan = result.plan!;

    expect(plan.needsClarification).toBe(true);
    expect(plan.clarificationQuestion?.trim().length).toBeGreaterThan(0);
    expect(plan.suggestedReplies?.filter((r) => r.trim()).length).toBeGreaterThanOrEqual(2);
    expect(plan.steps).toHaveLength(0);
  });
});

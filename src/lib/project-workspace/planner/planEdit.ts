import { getLLMClient } from './llmClient';
import {
  EDIT_PLAN_JSON_SCHEMA,
  EditPlanSchema,
  type EditPlan,
} from './editPlan.schema';
import { buildPlanEditSystemPrompt, buildPlanEditUserPrompt } from './planEditPrompt';
import type { SiteModel } from '../site-model/types';

const PLAN_MAX_TOKENS = parseInt(process.env.WEBSITE_EDIT_MAX_TOKENS || '4096', 10);

export interface PlanEditInput {
  siteModel: SiteModel;
  userPrompt: string;
}

export interface PlanEditResult {
  ok: boolean;
  plan?: EditPlan;
  error?: string;
}

/**
 * LLM planner: structured EditPlan with Zod validation and one retry on parse failure.
 */
export async function planEdit(input: PlanEditInput): Promise<PlanEditResult> {
  const llm = getLLMClient();
  const system = buildPlanEditSystemPrompt();
  const basePrompt = buildPlanEditUserPrompt(input.siteModel, input.userPrompt);

  let lastError = 'Planner returned invalid plan';

  for (let attempt = 0; attempt < 2; attempt++) {
    const repairHint =
      attempt > 0
        ? '\n\nPrevious response failed validation. Return ONLY valid JSON. If clarifying, steps must be [].'
        : '';

    const result = await llm.generateJSON<unknown>({
      system,
      prompt: `${basePrompt}${repairHint}`,
      schema: EDIT_PLAN_JSON_SCHEMA,
      maxTokens: PLAN_MAX_TOKENS,
      temperature: 0,
    });

    if (!result.ok) {
      lastError = 'LLM call failed or returned invalid JSON';
      continue;
    }

    const parsed = EditPlanSchema.safeParse(result.data);
    if (parsed.success) {
      return { ok: true, plan: parsed.data };
    }

    lastError = parsed.error.issues.map((i) => i.message).join('; ');
  }

  return { ok: false, error: lastError };
}

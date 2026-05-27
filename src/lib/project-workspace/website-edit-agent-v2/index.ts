export { EDIT_PLAN_SCHEMA } from './editPlanSchema';
export type {
  EditPlan,
  EditPlanStep,
  V2PlanConfidence,
  V2PlanIntent,
  V2PlanRoute,
  V2SkillName,
} from './editPlanSchema';
export { buildSiteModel, summarizeSiteModel } from './siteModel';
export type {
  SiteModel,
  SiteModelContact,
  SiteModelFileSnapshot,
  SiteModelHero,
  SiteModelSection,
} from './siteModel';
export { planEdit } from './planner';
export type { PlanEditOptions } from './planner';
export { executePlan, executeSkill } from './executor';
export type { ExecuteSkillResult } from './executor';

import { computeWorkspaceHashes } from '../workspaceEditShared';
import type { AgentStepEvent, WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../website-edit-agent/types';
import { executePlan } from './executor';
import { planEdit } from './planner';

function emitStep(
  onStep: ((event: AgentStepEvent) => void) | undefined,
  id: string,
  label: string,
  status: AgentStepEvent['status']
) {
  onStep?.({ type: 'step', id, label, status });
}

/**
 * Run Website Agent V2: plan with an LLM, execute V2-native config skills.
 */
export async function runWebsiteEditAgentV2(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  emitStep(onStep, 'v2_plan', 'Planning the website edit', 'active');
  const beforeHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const plan = await planEdit(options);
  emitStep(onStep, 'v2_plan', 'Planning the website edit', 'completed');

  emitStep(onStep, 'v2_execute', 'Applying the website edit', 'active');
  const result = await executePlan(plan, options, beforeHashes);
  emitStep(onStep, 'v2_execute', 'Applying the website edit', result.ok ? 'completed' : 'failed');

  return result;
}


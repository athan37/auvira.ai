import { getLLMClient } from './llmClient';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import {
  EDIT_PLAN_JSON_SCHEMA,
  EditPlanSchema,
  type EditPlan,
} from './editPlan.schema';
import { buildPlanEditSystemPrompt, buildPlanEditUserPrompt } from './planEditPrompt';
import { normalizeEditPlanPayload } from './normalizeEditPlan';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { guardUnsupportedPlanSkills } from './validatePlanSkills';
import { guardEditPlanSemantics } from './validateEditPlanSemantics';
import { normalizeMisroutedCopyPlan } from '@/lib/project-workspace/edit-agent/planFromConfigTextEdit';
import { tryExplorerPlan } from '@/lib/project-workspace/edit-agent/tryExplorerPlan';
import { isUnifiedCopyEditEnabled } from '@/lib/project-workspace/edit-context/unifiedCopyEditFlag';

const PLAN_MAX_TOKENS = parseInt(process.env.WEBSITE_EDIT_MAX_TOKENS || '4096', 10);

export interface PlanEditInput {
  editContext: EditContext;
  userPrompt: string;
  deterministicOnly?: boolean;
  hasAttachments?: boolean;
}

/** @deprecated Prefer editContext — builds minimal context from siteModel for legacy tests. */
export interface LegacyPlanEditInput {
  siteModel: SiteModel;
  userPrompt: string;
}

export type PlanEditInputUnion = PlanEditInput | LegacyPlanEditInput;

export interface PlanEditResult {
  ok: boolean;
  plan?: EditPlan;
  error?: string;
}

function isLegacyInput(input: PlanEditInputUnion): input is LegacyPlanEditInput {
  return 'siteModel' in input && !('editContext' in input);
}

async function resolveEditContext(input: PlanEditInputUnion): Promise<EditContext> {
  if (!isLegacyInput(input)) {
    return input.editContext;
  }
  const built = await buildEditContext({
    workspacePath: input.siteModel.workspacePath,
    mode: input.siteModel.mode,
    ownerMessage: input.userPrompt,
  });
  return built.context;
}

/**
 * LLM planner with deterministic fast-path for high-confidence edits.
 */
export async function planEdit(input: PlanEditInputUnion): Promise<PlanEditResult> {
  const editContext = await resolveEditContext(input);
  const userPrompt = isLegacyInput(input) ? input.userPrompt : input.userPrompt;
  const deterministicOnly = !isLegacyInput(input) ? input.deterministicOnly : false;
  const hasAttachments = !isLegacyInput(input) ? (input.hasAttachments ?? false) : false;
  const skillGuardOptions = { hasAttachments };

  const deterministic = buildDeterministicPlan(editContext);
  if (deterministic && !deterministic.needsClarification) {
    const parsed = EditPlanSchema.safeParse(normalizeEditPlanPayload(deterministic));
    if (parsed.success) {
      const guarded = guardUnsupportedPlanSkills(parsed.data, skillGuardOptions);
      const normalized = isUnifiedCopyEditEnabled()
        ? normalizeMisroutedCopyPlan(guarded, editContext)
        : guarded;
      return {
        ok: true,
        plan: guardEditPlanSemantics(normalized, editContext),
      };
    }
  }

  const explorerPlan = await tryExplorerPlan(editContext);
  if (explorerPlan) {
    const parsed = EditPlanSchema.safeParse(normalizeEditPlanPayload(explorerPlan));
    if (parsed.success) {
      const guarded = guardUnsupportedPlanSkills(parsed.data, skillGuardOptions);
      return {
        ok: true,
        plan: guardEditPlanSemantics(guarded, editContext),
      };
    }
  }

  if (deterministic?.needsClarification) {
    const parsed = EditPlanSchema.safeParse(normalizeEditPlanPayload(deterministic));
    if (parsed.success) {
      const guarded = guardUnsupportedPlanSkills(parsed.data, skillGuardOptions);
      return {
        ok: true,
        plan: guardEditPlanSemantics(guarded, editContext),
      };
    }
  }

  if (deterministicOnly) {
    return { ok: false, error: 'No deterministic plan available' };
  }

  const llm = getLLMClient();
  const system = buildPlanEditSystemPrompt();
  const basePrompt = buildPlanEditUserPrompt(editContext, userPrompt);

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

    const parsed = EditPlanSchema.safeParse(normalizeEditPlanPayload(result.data));
    if (parsed.success) {
      const guarded = guardUnsupportedPlanSkills(parsed.data, skillGuardOptions);
      const normalized = isUnifiedCopyEditEnabled()
        ? normalizeMisroutedCopyPlan(guarded, editContext)
        : guarded;
      return {
        ok: true,
        plan: guardEditPlanSemantics(normalized, editContext),
      };
    }

    lastError = parsed.error.issues.map((i) => i.message).join('; ');
  }

  return { ok: false, error: lastError };
}
